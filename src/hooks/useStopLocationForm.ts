import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { isValidCoordinatePair } from '@/lib/mapUtils';

export interface StopFormValues {
  name: string;
  latitude: string;
  longitude: string;
}

export const emptyStopFormValues = (): StopFormValues => ({
  name: '',
  latitude: '',
  longitude: '',
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

  const handleCoordinateChange = useCallback((field: 'latitude' | 'longitude', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  return {
    formData,
    setFormData,
    isLocating,
    parsedCoords,
    resetForm,
    handleUseCurrentLocation,
    handleCoordinateChange,
  };
}

export function parseStopFormCoordinates(formData: StopFormValues) {
  const parsedLat = formData.latitude ? parseFloat(formData.latitude) : undefined;
  const parsedLng = formData.longitude ? parseFloat(formData.longitude) : undefined;
  return { parsedLat, parsedLng };
}
