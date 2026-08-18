import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Wisper Logística</h1>

        <nav className="space-y-4">
          <Link
            href="/login"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold">Login</h2>
            <p className="text-gray-600">Iniciar sesión</p>
          </Link>

          <Link
            href="/dashboard"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold">Dashboard</h2>
            <p className="text-gray-600">Panel principal</p>
          </Link>

          <Link
            href="/clients"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold">Clientes</h2>
            <p className="text-gray-600">Gestión de clientes</p>
          </Link>

          <Link
            href="/technicians"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold">Técnicos</h2>
            <p className="text-gray-600">Gestión de técnicos</p>
          </Link>

          <Link
            href="/tickets"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold">Tickets</h2>
            <p className="text-gray-600">Gestión de tickets</p>
          </Link>

          <Link
            href="/map"
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold">Mapa</h2>
            <p className="text-gray-600">Vista de mapa</p>
          </Link>
        </nav>
      </div>
    </div>
  );
}
