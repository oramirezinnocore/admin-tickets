import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { hasValidCoordinates } from '@wisper/shared';

const IMPORT_LIMIT = 1000;

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
  } catch (error: any) {
    console.error('[Import] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
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

  // Validate each row
  const validationResults: ValidationResult[] = [];
  const seenKeys = new Set<string>();

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

    // Validate coordinates if provided
    if (row.latitude || row.longitude) {
      const lat = row.latitude ? parseFloat(row.latitude) : null;
      const lng = row.longitude ? parseFloat(row.longitude) : null;

      if (
        lat === null ||
        lng === null ||
        isNaN(lat) ||
        isNaN(lng) ||
        !hasValidCoordinates(lat, lng)
      ) {
        errors.push('Las coordenadas proporcionadas no son válidas');
      }
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

    validationResults.push({
      row: rowNumber,
      data: row,
      errors,
      isValid: errors.length === 0,
    });
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

async function handleImport(supabase: any, validatedRows: ValidationResult[]) {
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

    return {
      name: row.name.trim(),
      address: row.address.trim(),
      phone: row.phone?.trim() || null,
      reference: row.reference?.trim() || null,
      latitude: lat && !isNaN(lat) ? lat : null,
      longitude: lng && !isNaN(lng) ? lng : null,
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
