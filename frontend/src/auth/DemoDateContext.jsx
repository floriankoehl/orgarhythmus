import { createContext, useContext, useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { getDemoDate, setDemoDate } from '../api/org_API';

const DemoDateContext = createContext();

export function DemoDateProvider({ children }) {
  const [demoDate, setDemoDatea] = useState(dayjs());
  const [loading, setLoading] = useState(true);

  // Load demo date from backend on mount
  useEffect(() => {
    loadDemoDate();
  }, []);

  const loadDemoDate = async () => {
    try {
      const date = await getDemoDate();
      setDemoDatea(dayjs(date));
    } catch (error) {
      console.error('Failed to load demo date:', error);
      setDemoDatea(dayjs());
    } finally {
      setLoading(false);
    }
  };

  const addDays = async (days) => {
    const newDate = demoDate.add(days, 'day');
    try {
      await setDemoDate(newDate);
      setDemoDatea(newDate);
    } catch (error) {
      console.error('Failed to set demo date:', error);
    }
  };

  const subtractDays = async (days) => {
    const newDate = demoDate.subtract(days, 'day');
    try {
      await setDemoDate(newDate);
      setDemoDatea(newDate);
    } catch (error) {
      console.error('Failed to set demo date:', error);
    }
  };

  const resetToToday = async () => {
    const today = dayjs();
    try {
      await setDemoDate(today);
      setDemoDatea(today);
    } catch (error) {
      console.error('Failed to reset demo date:', error);
    }
  };

  return (
    <DemoDateContext.Provider value={{ demoDate, addDays, subtractDays, resetToToday, loading }}>
      {children}
    </DemoDateContext.Provider>
  );
}

export function useDemoDate() {
  const context = useContext(DemoDateContext);
  if (!context) {
    throw new Error('useDemoDate must be used within DemoDateProvider');
  }
  return context;
}
