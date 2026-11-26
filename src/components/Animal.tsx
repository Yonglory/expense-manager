import React from 'react';
import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg';
import type { AnimalId } from '../lib/types';

export const ANIMALS: { id: AnimalId; label: string }[] = [
  { id: 'bunny', label: 'Bunny' },
  { id: 'bear', label: 'Bear' },
  { id: 'cat', label: 'Kitty' },
  { id: 'lamb', label: 'Lamb' },
];

const FLUFF: [number, number, number][] = [
  [24, 30, 13], [12, 31, 6], [36, 31, 6], [24, 42, 6], [14, 39, 5],
  [34, 39, 5], [14, 22, 5], [34, 22, 5], [24, 19, 6],
];

const PALETTE: Record<AnimalId, { fill: string; stroke: string }> = {
  bunny: { fill: '#FFFFFF', stroke: '#E7D3C2' },
  bear: { fill: '#F3DEC6', stroke: '#D6B08A' },
  cat: { fill: '#FFE9D0', stroke: '#F0C79A' },
  lamb: { fill: '#FFFFFF', stroke: '#CFD8E6' },
};

function Fluff({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <>
      {FLUFF.map(([x, y, r], i) => (
        <Circle key={`s${i}`} cx={x} cy={y} r={r} fill={stroke} stroke={stroke} strokeWidth={2.4} />
      ))}
      {FLUFF.map(([x, y, r], i) => (
        <Circle key={`f${i}`} cx={x} cy={y} r={r} fill={fill} />
      ))}
    </>
  );
}

function Face() {
  return (
    <>
      <Circle cx={19} cy={27} r={1.8} fill="#5A4636" />
      <Circle cx={29} cy={27} r={1.8} fill="#5A4636" />
      <Circle cx={15.5} cy={31} r={2.6} fill="#F8C8D8" />
      <Circle cx={32.5} cy={31} r={2.6} fill="#F8C8D8" />
      <Ellipse cx={24} cy={30.5} rx={1.8} ry={1.3} fill="#F29BB5" />
      <Path d="M21.5 33 q2.5 2.5 5 0" stroke="#5A4636" strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </>
  );
}

function Ears({ animal }: { animal: AnimalId }) {
  const { fill, stroke } = PALETTE[animal];
  switch (animal) {
    case 'bunny':
      return (
        <>
          <Ellipse cx={17} cy={9} rx={4.5} ry={9} fill={fill} stroke={stroke} strokeWidth={1.6} />
          <Ellipse cx={31} cy={9} rx={4.5} ry={9} fill={fill} stroke={stroke} strokeWidth={1.6} />
          <Ellipse cx={17} cy={9.5} rx={2} ry={6} fill="#F8C8D8" />
          <Ellipse cx={31} cy={9.5} rx={2} ry={6} fill="#F8C8D8" />
        </>
      );
    case 'bear':
      return (
        <>
          <Circle cx={13} cy={14} r={6.5} fill={fill} stroke={stroke} strokeWidth={1.6} />
          <Circle cx={35} cy={14} r={6.5} fill={fill} stroke={stroke} strokeWidth={1.6} />
          <Circle cx={13} cy={14} r={3} fill="#F8C8D8" />
          <Circle cx={35} cy={14} r={3} fill="#F8C8D8" />
        </>
      );
    case 'cat':
      return (
        <>
          <Polygon points="10,20 12,3 25,13" fill={fill} stroke={stroke} strokeWidth={1.6} />
          <Polygon points="38,20 36,3 23,13" fill={fill} stroke={stroke} strokeWidth={1.6} />
          <Polygon points="13,15 13.5,7 19,12" fill="#F8C8D8" />
          <Polygon points="35,15 34.5,7 29,12" fill="#F8C8D8" />
        </>
      );
    case 'lamb':
      return (
        <>
          <Ellipse cx={9} cy={23} rx={5} ry={3} fill="#F1D9C8" stroke="#DDBFA8" strokeWidth={1.4} />
          <Ellipse cx={39} cy={23} rx={5} ry={3} fill="#F1D9C8" stroke="#DDBFA8" strokeWidth={1.4} />
        </>
      );
  }
}

export function Animal({ animal, size = 40 }: { animal: AnimalId; size?: number }) {
  const { fill, stroke } = PALETTE[animal] ?? PALETTE.bunny;
  const a: AnimalId = PALETTE[animal] ? animal : 'bunny';
  return (
    <Svg width={size} height={size} viewBox="-3 -3 54 54">
      <Ears animal={a} />
      <Fluff fill={fill} stroke={stroke} />
      {a === 'lamb' && <Ellipse cx={24} cy={29} rx={9.5} ry={9} fill="#F1D9C8" />}
      <Face />
    </Svg>
  );
}
