import { NextRequest, NextResponse } from 'next/server';

const PHOTON_BASE_URL = process.env.GEOCODING_BASE_URL || 'https://photon.komoot.io';
const MORELIA_LAT = 19.7037;
const MORELIA_LON = -101.1949;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    // Validación
    if (!query) {
      return NextResponse.json(
        { error: 'Parámetro "q" requerido' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
      return NextResponse.json(
        { error: 'La búsqueda debe tener al menos 3 caracteres' },
        { status: 400 }
      );
    }

    if (trimmedQuery.length > 250) {
      return NextResponse.json(
        { error: 'La búsqueda es demasiado larga' },
        { status: 400 }
      );
    }

    console.log('[Geocode] Query:', trimmedQuery);

    // Construir URL de Photon con trailing slash
    const photonUrl = new URL('/api/', PHOTON_BASE_URL);
    photonUrl.searchParams.set('q', trimmedQuery);
    photonUrl.searchParams.set('lat', MORELIA_LAT.toString());
    photonUrl.searchParams.set('lon', MORELIA_LON.toString());
    photonUrl.searchParams.set('limit', '5');
    // NO usar lang=es, Photon solo soporta: default, de, en, fr

    console.log('[Geocode] Photon URL:', photonUrl.toString());

    // Llamar a Photon con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(photonUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Wisper-Admin/1.0',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[Geocode] Photon status:', response.status);
      console.log('[Geocode] Photon content-type:', response.headers.get('content-type'));

      if (!response.ok) {
        // Intentar leer el body del error para logging
        const contentType = response.headers.get('content-type') || '';
        let errorBody = '';

        try {
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            errorBody = JSON.stringify(errorData);
          } else {
            errorBody = await response.text();
          }
          console.error('[Geocode] Photon error body:', errorBody.substring(0, 500));
        } catch (e) {
          console.error('[Geocode] Could not read error body');
        }

        return NextResponse.json(
          {
            error: 'No fue posible consultar el servicio de búsqueda.',
            providerStatus: response.status
          },
          { status: 502 }
        );
      }

      // Verificar content-type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.error('[Geocode] Unexpected content-type:', contentType);
        const textBody = await response.text();
        console.error('[Geocode] Response body preview:', textBody.substring(0, 200));

        return NextResponse.json(
          { error: 'El proveedor de geocodificación devolvió una respuesta inválida.' },
          { status: 502 }
        );
      }

      const data = await response.json();
      console.log('[Geocode] Features count:', data.features?.length || 0);

      // Transformar respuesta de Photon a formato más simple
      const results = (data.features || [])
        .map((feature: any) => {
          const coordinates = feature.geometry?.coordinates;

          // Validar coordenadas: [longitude, latitude]
          if (!coordinates || coordinates.length < 2) {
            return null;
          }

          const longitude = coordinates[0];
          const latitude = coordinates[1];

          // Validar rangos
          if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return null;
          }

          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return null;
          }

          return {
            id: feature.properties?.osm_id?.toString() || Math.random().toString(),
            name: feature.properties?.name || '',
            street: feature.properties?.street || '',
            housenumber: feature.properties?.housenumber || '',
            city: feature.properties?.city || '',
            state: feature.properties?.state || '',
            postcode: feature.properties?.postcode || '',
            country: feature.properties?.country || '',
            latitude,
            longitude,
          };
        })
        .filter((result: any) => result !== null);

      console.log('[Geocode] Valid results:', results.length);

      return NextResponse.json(
        { results },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error: any) {
    console.error('[Geocode] Error:', error.name, error.message);

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'El servicio de búsqueda tardó demasiado en responder.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
