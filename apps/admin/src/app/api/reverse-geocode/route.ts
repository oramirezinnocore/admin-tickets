import { NextRequest, NextResponse } from 'next/server';

const PHOTON_BASE_URL = process.env.GEOCODING_BASE_URL || 'https://photon.komoot.io';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    // Validación
    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Parámetros "lat" y "lon" requeridos' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Validar rangos
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    if (latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { error: 'Latitud debe estar entre -90 y 90' },
        { status: 400 }
      );
    }

    if (longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Longitud debe estar entre -180 y 180' },
        { status: 400 }
      );
    }

    console.log('[ReverseGeocode] Coordinates:', { latitude, longitude });

    // Construir URL de Photon reverse
    const photonUrl = new URL('/reverse', PHOTON_BASE_URL);
    photonUrl.searchParams.set('lat', latitude.toString());
    photonUrl.searchParams.set('lon', longitude.toString());
    // NO usar lang=es, Photon solo soporta: default, de, en, fr

    console.log('[ReverseGeocode] Photon URL:', photonUrl.toString());

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

      console.log('[ReverseGeocode] Photon status:', response.status);

      if (!response.ok) {
        console.error('[ReverseGeocode] Photon error:', response.status, response.statusText);
        return NextResponse.json(
          {
            error: 'No fue posible obtener la dirección.',
            providerStatus: response.status
          },
          { status: 502 }
        );
      }

      // Verificar content-type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.error('[ReverseGeocode] Unexpected content-type:', contentType);
        return NextResponse.json(
          { error: 'El proveedor de geocodificación devolvió una respuesta inválida.' },
          { status: 502 }
        );
      }

      const data = await response.json();
      console.log('[ReverseGeocode] Features count:', data.features?.length || 0);

      // Photon reverse devuelve el lugar más cercano
      const feature = data.features?.[0];

      if (!feature || !feature.properties) {
        return NextResponse.json(
          { address: null },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
          }
        );
      }

      const props = feature.properties;

      // Construir label de dirección
      const parts: string[] = [];

      if (props.name) parts.push(props.name);
      if (props.street) {
        if (props.housenumber) {
          parts.push(`${props.street} ${props.housenumber}`);
        } else {
          parts.push(props.street);
        }
      }
      if (props.city) parts.push(props.city);
      if (props.state) parts.push(props.state);

      const label = parts.length > 0 ? parts.join(', ') : 'Ubicación sin nombre';

      const address = {
        label,
        name: props.name || '',
        street: props.street || '',
        housenumber: props.housenumber || '',
        city: props.city || '',
        district: props.district || '',
        state: props.state || '',
        postcode: props.postcode || '',
        country: props.country || '',
      };

      console.log('[ReverseGeocode] Address label:', label);

      return NextResponse.json(
        { address },
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
    console.error('[ReverseGeocode] Error:', error.name, error.message);

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
