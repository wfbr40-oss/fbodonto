'use client';

import { useEffect } from 'react';
import { precarregarLogo } from '@/lib/logoCache';

export default function LogoPreloader() {
  useEffect(() => {
    void precarregarLogo('/logo.png');
  }, []);

  return null;
}
