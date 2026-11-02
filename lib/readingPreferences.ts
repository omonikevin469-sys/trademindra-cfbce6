import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { errorFeedback, selection } from '@/lib/journal';
export const minimumFontSize = 11;
export const maximumFontSize = 60;
export const defaultFontSize = 16;
export function validFontSize(size: number) {
  return Number.isInteger(size) && size >= minimumFontSize && size <= maximumFontSize;
}
export const useReadingPreferences = create<{
  fontSize: number;
  saveError: boolean;
  setFontSize: (size: number) => void;
}>()(
  persist(
    (set) => ({
      fontSize: defaultFontSize,
      saveError: false,
      setFontSize: (fontSize) => {
        if (!validFontSize(fontSize)) return;
        selection();
        set({ fontSize, saveError: false });
      },
    }),
    {
      name: 'trademindra-reading-preferences',
      version: 1,
      migrate: (stored) => {
        const value =
          typeof stored === 'object' && stored !== null && 'fontSize' in stored
            ? stored.fontSize
            : undefined;
        const presets: Record<string, number> = { Standard: 16, Large: 18, Largest: 21 };
        const size = typeof value === 'string' ? presets[value] : value;
        return {
          fontSize: typeof size === 'number' && validFontSize(size) ? size : defaultFontSize,
        };
      },
      storage: createJSONStorage(() => ({
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: async (key, value) => {
          try {
            await AsyncStorage.setItem(key, value);
          } catch {
            if (!useReadingPreferences.getState().saveError) {
              useReadingPreferences.setState({ saveError: true });
              errorFeedback();
            }
          }
        },
        removeItem: (key) => AsyncStorage.removeItem(key),
      })),
      partialize: ({ fontSize }) => ({ fontSize }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          useReadingPreferences.setState({ saveError: true });
          errorFeedback();
        }
      },
    },
  ),
);
export function useReadingScale() {
  return useReadingPreferences((state) => state.fontSize) / defaultFontSize;
}
