import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  getGoogleMapsUrl,
  parseCoordinatesFromMapLink,
  isValidCoordinatePair,
} from '@/lib/mapUtils';

export interface StopFormValues {
  name: string;
  latitude: string;
  longitude: string;
  mapLink: string;
}

export const emptyStopFormValues = (): StopFormValues => ({
  name: '',
  latitude: '',
  longitude: '',
  mapLink: '',
});

export function useStopLocationForm(initial?: Partial<StopFormValues>) {
  const [formData, setFormData] = useState<StopFormValues>({
    ...emptyStopFormValues(),
    ...initial,
  });
  const [isLocating, setIsLocating] = useState(false);

  const parsedCoords = useMemo(() => {
    const lat = formData.latitude ? parseFloat(formData.latitude) : NaN;
    const lng = formData.longitude ? parseFloat(formData.longitude) : NaN;
    return isValidCoordinatePair(lat, lng) ? { lat, lng } : null;
  }, [formData.latitude, formData.longitude]);

  const resetForm = useCallback((values?: Partial<StopFormValues>) => {
    setFormData({ ...emptyStopFormValues(), ...values });
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setFormData((prev) => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          mapLink: getGoogleMapsUrl(lat, lng),
        }));
        setIsLocating(false);
        toast.success('Location captured', {
          description: `Accuracy ±${Math.round(position.coords.accuracy)}m`,
        });
      },
      (error) => {
        setIsLocating(false);
        toast.error('Could not get location', { description: error.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  const handleMapLinkChange = useCallback((value: string) => {
    setFormData((prev) => {
      const next = { ...prev, mapLink: value };
      const coords = parseCoordinatesFromMapLink(value);
      if (coords) {
        next.latitude = coords.lat.toFixed(6);
        next.longitude = coords.lng.toFixed(6);
      }
      return next;
    });
  }, []);

  const handleCoordinateChange = useCallback((field: 'latitude' | 'longitude', value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      const lat = parseFloat(field === 'latitude' ? value : prev.latitude);
      const lng = parseFloat(field === 'longitude' ? value : prev.longitude);
      if (isValidCoordinatePair(lat, lng)) {
        next.mapLink = getGoogleMapsUrl(lat, lng);
      }
      return next;
    });
  }, []);

  const buildMapLink = useCallback((): string | undefined => {
    const lat = formData.latitude ? parseFloat(formData.latitude) : undefined;
    const lng = formData.longitude ? parseFloat(formData.longitude) : undefined;
    return (
      formData.mapLink.trim() ||
      (isValidCoordinatePair(lat, lng) ? getGoogleMapsUrl(lat!, lng!) : undefined)
    );
  }, [formData]);

  return {
    formData,
    setFormData,
    isLocating,
    parsedCoords,
    resetForm,
    handleUseCurrentLocation,
    handleMapLinkChange,
    handleCoordinateChange,
    buildMapLink,
  };
}

export function parseStopFormCoordinates(formData: StopFormValues) {
  const parsedLat = formData.latitude ? parseFloat(formData.latitude) : undefined;
  const parsedLng = formData.longitude ? parseFloat(formData.longitude) : undefined;
  const mapLink =
    formData.mapLink.trim() ||
    (isValidCoordinatePair(parsedLat, parsedLng) ? getGoogleMapsUrl(parsedLat!, parsedLng!) : undefined);
  return { parsedLat, parsedLng, mapLink };
}
