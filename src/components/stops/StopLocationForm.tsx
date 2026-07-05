import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Loader2, Navigation } from 'lucide-react';
import { getGoogleMapsUrl, getOpenStreetMapEmbedUrl } from '@/lib/mapUtils';
import type { StopFormValues } from '@/hooks/useStopLocationForm';

interface StopLocationFormProps {
  formData: StopFormValues;
  isLocating: boolean;
  parsedCoords: { lat: number; lng: number } | null;
  onNameChange: (name: string) => void;
  onCoordinateChange: (field: 'latitude' | 'longitude', value: string) => void;
  onUseCurrentLocation: () => void;
  nameInputId?: string;
  nameLabel?: string;
}

export function StopLocationForm({
  formData,
  isLocating,
  parsedCoords,
  onNameChange,
  onCoordinateChange,
  onUseCurrentLocation,
  nameInputId = 'stopName',
  nameLabel = 'Stop Name',
}: StopLocationFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameInputId}>{nameLabel}</Label>
        <Input
          id={nameInputId}
          value={formData.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Main Market"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${nameInputId}-lat`}>Latitude</Label>
          <Input
            id={`${nameInputId}-lat`}
            type="number"
            step="any"
            value={formData.latitude}
            onChange={(e) => onCoordinateChange('latitude', e.target.value)}
            placeholder="e.g., 16.7050"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${nameInputId}-lng`}>Longitude</Label>
          <Input
            id={`${nameInputId}-lng`}
            type="number"
            step="any"
            value={formData.longitude}
            onChange={(e) => onCoordinateChange('longitude', e.target.value)}
            placeholder="e.g., 74.2433"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4 mr-2" />
          )}
          Use Current Location
        </Button>
        {parsedCoords && (
          <Button type="button" variant="outline" className="flex-1 min-w-0" asChild>
            <a
              href={getGoogleMapsUrl(parsedCoords.lat, parsedCoords.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 truncate"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="truncate">Open in Google Maps</span>
            </a>
          </Button>
        )}
      </div>

      {parsedCoords && (
        <div className="space-y-2">
          <Label>Map Preview</Label>
          <div className="rounded-lg border overflow-hidden h-36 sm:h-52 bg-muted">
            <iframe
              title="Stop location preview"
              className="w-full h-full border-0"
              loading="lazy"
              src={getOpenStreetMapEmbedUrl(parsedCoords.lat, parsedCoords.lng)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
