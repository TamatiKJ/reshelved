import { useEffect, useState } from 'react';
import { getActiveLocationsWithFallback, type LocationOption } from '../services/locations';

export const useLocations = () => {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadLocations = async () => {
      setLoading(true);
      try {
        const items = await getActiveLocationsWithFallback();
        if (!mounted) return;
        setLocations(items);
      } catch (error) {
        console.error('Could not load locations:', error);
        if (!mounted) return;
        setLocations([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadLocations();

    return () => {
      mounted = false;
    };
  }, []);

  return { locations, loading };
};
