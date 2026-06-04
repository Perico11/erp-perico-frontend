import { useState } from 'react';
import OCCard from './OCCard';

const S = {
  grid: {
    display: 'grid', gap: 12, marginBottom: 16,
  },
};

export default function OCList({ ocs, onRefresh }) {
  return (
    <div style={S.grid}>
      {ocs.map(oc => (
        <OCCard key={oc.id} oc={oc} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
