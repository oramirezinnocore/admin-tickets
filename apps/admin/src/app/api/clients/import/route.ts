import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { hasValidCoordinates } from '@wisper/shared';

const IMPORT_LIMIT = 1000;
const GEOCODE_BATCH_SIZE = 5; // Max concurrent geocoding requests

interface ImportRow {
  name: string;
  address: string;
  phone?: string;
  reference?: string;
  latitude?: string;
  longitude?: string;
}

interface ValidationResult {
  row: number;
  data: ImportRow;
  errors: string[];
  isValid: boolean;
  coordinateSource?: 'csv' | 'geocoded';
}

interface GeocodeResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

/**
 * Geocode a single address using the existing /api/geocode endpoint
 */
async function geocodeAddress(address: string): Promise<GeocodeResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = new URL('/api/geocode', baseUrl);
    url.searchParams.set('q', address);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Geocoding service unavailable' };
    }

    const data = await response.json();

    // Check if we got results
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { success: false, error: 'Address not found' };
    }

    const firstResult = data[0];
    if (
      typeof firstResult.latitude === 'number' &&
      typeof firstResult.longitude === 'number' &&
      hasValidCoordinates(firstResult.latitude, firstResult.longitude)
    ) {
      return {
        success: true,
        latitude: firstResult.latitude,
        longitude: firstResult.longitude,
      };
    }

    return { success: false, error: 'Invalid coordinates from geocoder' };
  } catch (error) {
    console.error('[Geocode] Error:', error);
    return { success: false, error: 'Geocoding failed' };
  }
}

/**
 * Process items in batches with concurrency control
 */
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create Supabase client with user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify user is SUPER_ADMIN
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo SUPER_ADMIN puede importar clientes.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, csvContent, validatedRows } = body;

    if (action === 'validate') {
      // PHASE 1: Validate CSV content
      return await handleValidation(csvContent);
    } else if (action === 'import') {
      // PHASE 2: Import validated rows
      return await handleImport(supabase, validatedRows);
    } else {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('[Import] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function handleValidation(csvContent: string) {
  // Parse CSV
  const parseResult = Papa.parse<ImportRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  if (parseResult.errors.length > 0) {
    return NextResponse.json(
      {
        error: 'Error al procesar el archivo CSV',
        details: parseResult.errors.map(e => e.message).join(', '),
      },
      { status: 400 }
    );
  }

  const rows = parseResult.data;

  // Check limit
  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'El archivo no contiene registros válidos' },
      { status: 400 }
    );
  }

  if (rows.length > IMPORT_LIMIT) {
    return NextResponse.json(
      { error: `El archivo excede el límite de ${IMPORT_LIMIT} registros` },
      { status: 400 }
    );
  }

  // Validate headers
  const headers = parseResult.meta.fields || [];
  const requiredHeaders = ['name', 'address'];
  const optionalHeaders = ['phone', 'reference', 'latitude', 'longitude'];
  const validHeaders = [...requiredHeaders, ...optionalHeaders];

  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return NextResponse.json(
      {
        error: `El archivo debe contener las columnas: ${requiredHeaders.join(', ')}`,
        missing: missingHeaders,
      },
      { status: 400 }
    );
  }

  const invalidHeaders = headers.filter(h => !validHeaders.includes(h));
  if (invalidHeaders.length > 0) {
    return NextResponse.json(
      {
        error: `El archivo contiene columnas no reconocidas: ${invalidHeaders.join(', ')}`,
        note: `Columnas permitidas: ${validHeaders.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // PHASE 1: Initial validation
  const validationResults: ValidationResult[] = [];
  const seenKeys = new Set<string>();
  const rowsNeedingGeocode: Array<{ index: number; address: string }> = [];

  rows.forEach((row, index) => {
    const errors: string[] = [];
    const rowNumber = index + 2; // +1 for 0-index, +1 for header row

    // Validate required fields
    if (!row.name || !row.name.trim()) {
      errors.push('El nombre es obligatorio');
    }

    if (!row.address || !row.address.trim()) {
      errors.push('La dirección es obligatoria');
    }

    // Check for duplicates within the file (based on name+address)
    if (row.name && row.address) {
      const key = `${row.name.trim().toLowerCase()}|${row.address.trim().toLowerCase()}`;
      if (seenKeys.has(key)) {
        errors.push('Cliente duplicado dentro del archivo (mismo nombre y dirección)');
      } else {
        seenKeys.add(key);
      }
    }

    // Coordinate validation logic
    const hasLat = row.latitude && row.latitude.trim() !== '';
    const hasLng = row.longitude && row.longitude.trim() !== '';

    if (hasLat && hasLng) {
      // Both provided - validate them
      const lat = parseFloat(row.latitude!);
      const lng = parseFloat(row.longitude!);

      if (isNaN(lat) || isNaN(lng) || !hasValidCoordinates(lat, lng)) {
        errors.push('Las coordenadas proporcionadas no son válidas');
      }
    } else if (hasLat || hasLng) {
      // Partial coordinates - invalid
      errors.push(
        'Debe proporcionar ambas coordenadas (latitude y longitude) o ninguna. Solo una coordenada no es válida.'
      );
    } else if (row.address && row.address.trim()) {
      // No coordinates provided - will need geocoding
      rowsNeedingGeocode.push({
        index,
        address: row.address.trim(),
      });
    }

    validationResults.push({
      row: rowNumber,
      data: row,
      errors,
      isValid: errors.length === 0,
      coordinateSource: hasLat && hasLng ? 'csv' : undefined,
    });
  });

  // PHASE 2: Geocode addresses for rows without coordinates
  if (rowsNeedingGeocode.length > 0) {
    console.log(`[Import] Geocoding ${rowsNeedingGeocode.length} addresses...`);

    const geocodeResults = await processBatch(
      rowsNeedingGeocode,
      GEOCODE_BATCH_SIZE,
      async item => {
        const result = await geocodeAddress(item.address);
        return { ...item, geocode: result };
      }
    );

    // Apply geocoding results
    geocodeResults.forEach(({ index, geocode }) => {
      const validation = validationResults[index];

      if (geocode.success && geocode.latitude && geocode.longitude) {
        // Success: update data with geocoded coordinates
        validation.data.latitude = geocode.latitude.toString();
        validation.data.longitude = geocode.longitude.toString();
        validation.coordinateSource = 'geocoded';
      } else {
        // Failed: mark as invalid
        validation.errors.push(
          `No se pudo geocodificar la dirección: ${geocode.error || 'dirección no encontrada'}`
        );
        validation.isValid = false;
      }
    });
  }

  // PHASE 3: Final validation - ensure all rows have coordinates
  validationResults.forEach(result => {
    if (result.isValid) {
      const hasLat = result.data.latitude && result.data.latitude.trim() !== '';
      const hasLng = result.data.longitude && result.data.longitude.trim() !== '';

      if (!hasLat || !hasLng) {
        result.errors.push('No se pudieron obtener coordenadas válidas para esta dirección');
        result.isValid = false;
      }
    }
  });

  const validCount = validationResults.filter(r => r.isValid).length;
  const invalidCount = validationResults.length - validCount;

  return NextResponse.json({
    success: true,
    total: rows.length,
    valid: validCount,
    invalid: invalidCount,
    results: validationResults,
    canImport: invalidCount === 0, // Only allow import if all rows are valid
  });
}

async function handleImport(
  supabase: SupabaseClient,
  validatedRows: ValidationResult[]
) {
  if (!Array.isArray(validatedRows) || validatedRows.length === 0) {
    return NextResponse.json(
      { error: 'No hay registros válidos para importar' },
      { status: 400 }
    );
  }

  // Double-check all rows are valid
  const invalidRows = validatedRows.filter(r => !r.isValid);
  if (invalidRows.length > 0) {
    return NextResponse.json(
      { error: 'Solo se pueden importar registros válidos' },
      { status: 400 }
    );
  }

  // Prepare batch insert
  const clientsToInsert = validatedRows.map(result => {
    const row = result.data;
    const lat = row.latitude ? parseFloat(row.latitude) : null;
    const lng = row.longitude ? parseFloat(row.longitude) : null;

    // Validate coordinates exist and are valid
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      throw new Error(
        `Fila ${result.row}: No tiene coordenadas válidas. Este error no debería ocurrir después de la validación.`
      );
    }

    if (!hasValidCoordinates(lat, lng)) {
      throw new Error(
        `Fila ${result.row}: Las coordenadas están fuera del rango válido. Este error no debería ocurrir después de la validación.`
      );
    }

    return {
      name: row.name.trim(),
      address: row.address.trim(),
      phone: row.phone?.trim() || null,
      reference: row.reference?.trim() || null,
      latitude: lat,
      longitude: lng,
      is_active: true,
    };
  });

  // Batch insert
  const { data, error } = await supabase.from('clients').insert(clientsToInsert).select();

  if (error) {
    console.error('[Import] Database error:', error);
    return NextResponse.json(
      { error: 'Error al insertar clientes en la base de datos', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    imported: data?.length || 0,
    clients: data,
  });
}
