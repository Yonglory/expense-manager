import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../lib/theme';
import { parseAmount } from '../lib/format';
import type { Item, Kind } from '../lib/types';
import { Button, Field } from './ui';
import { Sheet, sheetTitle } from './Sheet';

type Props = {
  visible: boolean;
  kind: Kind;
  item: Item | null; // null = adding
  onClose: () => void;
  onSave: (name: string, amount: number, actual: number | null) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

export function ItemModal({ visible, kind, item, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [actual, setActual] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(item?.name ?? '');
      setAmount(item ? String(item.amount) : '');
      setActual(item?.actual != null ? String(item.actual) : '');
      setError(null);
    }
  }, [visible, item]);

  const save = async () => {
    if (!name.trim()) return setError('Give this item a name.');
    await onSave(name.trim(), parseAmount(amount), actual.trim() === '' ? null : parseAmount(actual));
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{item ? 'Edit item' : kind === 'out' ? 'Add to Money out' : 'Add to Money in'}</Text>
      <Field placeholder="Name, for example Groceries" value={name} onChangeText={setName} autoFocus />
      <Field placeholder={kind === 'out' ? 'Planned amount' : 'Amount'} value={amount} onChangeText={setAmount} keyboardType="numeric" />
      {kind === 'out' && (
        <>
          <Field placeholder="Actual spent (optional)" value={actual} onChangeText={setActual} keyboardType="numeric" />
          <Text style={s.hint}>Fill in the actual amount if the real cost was different from the plan. Leave it empty if it matched.</Text>
        </>
      )}
      {error && <Text style={s.error}>{error}</Text>}
      <Button label="Save" onPress={save} />
      {item && <Button label="Delete item" tone="danger" onPress={onDelete} />}
      <Button label="Cancel" tone="soft" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  hint: { color: colors.sub, fontSize: 12 },
  error: { color: colors.peachText, backgroundColor: colors.peach, padding: 8, borderRadius: 10, fontSize: 13 },
});
