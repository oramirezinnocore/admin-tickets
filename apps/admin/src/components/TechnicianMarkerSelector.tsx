'use client';

import { TechnicianMarkerIcon, TechnicianMarkerColor } from '@wisper/shared';
import {
  MARKER_ICONS,
  MARKER_COLORS,
  getMarkerIconComponent,
  getMarkerColorHex,
  getMarkerColorBgClass,
} from '@/lib/technician-markers';

interface TechnicianMarkerSelectorProps {
  selectedIcon: TechnicianMarkerIcon | null;
  selectedColor: TechnicianMarkerColor | null;
  onIconChange: (icon: TechnicianMarkerIcon) => void;
  onColorChange: (color: TechnicianMarkerColor) => void;
  technicianName?: string;
}

export default function TechnicianMarkerSelector({
  selectedIcon,
  selectedColor,
  onIconChange,
  onColorChange,
  technicianName = 'Técnico',
}: TechnicianMarkerSelectorProps) {
  const IconComponent = getMarkerIconComponent(selectedIcon);
  const colorHex = getMarkerColorHex(selectedColor);
  const colorBgClass = getMarkerColorBgClass(selectedColor);

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Marcador en mapa
        </h3>
        <p className="text-xs text-gray-500">
          Personaliza el icono y color para identificar fácilmente al técnico en los mapas
        </p>
      </div>

      {/* Icon Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de vehículo/icono
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MARKER_ICONS.map(option => {
            const Icon = option.Icon;
            const isSelected = selectedIcon === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onIconChange(option.value)}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                `}
                aria-label={`Seleccionar ${option.label}`}
                aria-pressed={isSelected}
              >
                <Icon className={`w-6 h-6 mb-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                <span className={`text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color de identificación
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {MARKER_COLORS.map(option => {
            const isSelected = selectedColor === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onColorChange(option.value)}
                className={`
                  relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-gray-900 ring-2 ring-gray-900 ring-opacity-30'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                `}
                aria-label={`Seleccionar color ${option.label}`}
                aria-pressed={isSelected}
              >
                <div
                  className={`w-8 h-8 rounded-full ${option.tailwindBg} shadow-sm`}
                  style={{ backgroundColor: option.hex }}
                />
                <span className="text-xs font-medium text-gray-700 mt-1">
                  {option.label}
                </span>
                {isSelected && (
                  <div className="absolute top-1 right-1 w-3 h-3 bg-gray-900 rounded-full flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Vista previa
        </label>
        <div className="flex items-center gap-3">
          {/* Marker Preview */}
          <div
            className={`
              relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg
              border-3 border-white
            `}
            style={{ backgroundColor: colorHex }}
          >
            <IconComponent className="w-6 h-6 text-white" />
          </div>

          {/* Technician Name */}
          <div>
            <p className="font-medium text-gray-900">{technicianName}</p>
            <p className="text-xs text-gray-500">Así aparecerá en el mapa</p>
          </div>
        </div>
      </div>
    </div>
  );
}
