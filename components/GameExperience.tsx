'use client';

import { useCallback, useState } from 'react';
import BubbleGameCanvas from '@/app/game/BubbleGameCanvas';
import PayButton from './PayButton';

export default function GameExperience() {
  const [boosterSignal, setBoosterSignal] = useState(0);

  const handleBoost = useCallback(() => {
    setBoosterSignal(Date.now());
  }, []);

  return (
    <>
      <BubbleGameCanvas boosterSignal={boosterSignal} />
      <PayButton onBoost={handleBoost} />
    </>
  );
}
