import React from 'react';
import { AtlasCorridorMap } from '@/components/visualizations/atlas-corridor-map';

export default function CorridorMapPage() {
  return (
    <div className="flex h-full flex-col">
      <AtlasCorridorMap />
    </div>
  );
}
