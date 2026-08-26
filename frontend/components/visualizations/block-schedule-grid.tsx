'use client';
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DepartmentTag } from '@/components/shared/department-tag';
import { Department } from '@/lib/types';
import { BlockStatusPill } from '@/components/shared/block-status-pill';

const DAYS = ['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22'];
const SECTIONS = ['DLI-PNP', 'PNP-UMB', 'UMB-LDH', 'LDH-JUC', 'JUC-ASR'];

// Dummy data for blocks mapped to (section, day)
const MOCK_BLOCKS = [
  { id: 'BLK-402', dept: 'CIVIL' as Department, section: 'DLI-PNP', dayIdx: 0, status: 'APPROVED_SR_DOM', duration: '10:00 - 14:00' },
  { id: 'BLK-415', dept: 'TRD' as Department, section: 'UMB-LDH', dayIdx: 2, status: 'DRAFT', duration: '08:00 - 12:00' },
  { id: 'BLK-502', dept: 'SNT' as Department, section: 'JUC-ASR', dayIdx: 5, status: 'SENTINEL_PASSED', duration: '12:00 - 15:00' },
];

export function BlockScheduleGrid() {
  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Grid Header (Days) */}
      <div className="grid grid-cols-[120px_1fr] border-b bg-muted/30 sticky top-0 z-10">
        <div className="p-3 border-r font-semibold text-xs text-muted-foreground flex items-center justify-center">
          Section
        </div>
        <div className="grid grid-cols-7">
          {DAYS.map(day => (
            <div key={day} className="p-3 text-center border-r last:border-r-0 font-semibold text-sm">
              {day}
            </div>
          ))}
        </div>
      </div>
      
      {/* Grid Body */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-[120px_1fr]">
          {/* Section Axis */}
          <div className="flex flex-col border-r bg-muted/10 sticky left-0 z-10">
            {SECTIONS.map(section => (
              <div key={section} className="h-32 border-b flex items-center justify-center font-mono text-sm font-medium">
                {section}
              </div>
            ))}
          </div>
          
          {/* Timeline Area */}
          <div className="relative">
            {/* Background Grid */}
            {SECTIONS.map((_, rIdx) => (
              <div key={`row-${rIdx}`} className="grid grid-cols-7 h-32 border-b">
                {DAYS.map((_, cIdx) => (
                  <div key={`cell-${rIdx}-${cIdx}`} className="border-r last:border-r-0 hover:bg-accent/10 transition-colors relative" />
                ))}
              </div>
            ))}

            {/* Block Overlays */}
            {MOCK_BLOCKS.map(block => {
              const rowIdx = SECTIONS.indexOf(block.section);
              if (rowIdx === -1) return null;
              
              // Absolute positioning over the grid
              return (
                <div 
                  key={block.id}
                  className="absolute p-2"
                  style={{
                    top: `${rowIdx * 8}rem`,
                    left: `${(block.dayIdx / 7) * 100}%`,
                    width: `${(1 / 7) * 100}%`,
                    height: '8rem',
                  }}
                >
                  <div className="h-full w-full rounded-md border shadow-sm bg-card p-2 flex flex-col gap-1 hover:border-primary/50 cursor-pointer transition-colors overflow-hidden">
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold">{block.id}</span>
                      <DepartmentTag dept={block.dept} />
                    </div>
                    <div className="text-xs font-mono mt-1 text-muted-foreground">{block.duration}</div>
                    <div className="mt-auto">
                      <BlockStatusPill status={block.status as any} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
