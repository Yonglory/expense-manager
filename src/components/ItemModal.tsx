import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors } from '../lib/theme';
import { parseAmount } from '../lib/format';
import { useI18n } from '../i18n/I18nContext';
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
  const { t } = useI18n();
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
    if (!name.trim()) return setError(t.nameRequired);
    await onSave(name.trim(), parseAmount(amount), actual.trim() === '' ? null : parseAmount(actual));
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{item ? t.editItem : kind === 'out' ? t.addToOut : t.addToIn}</Text>
      <Field placeholder={t.namePh} value={name} onChangeText={setName} autoFocus />
      <Field placeholder={kind === 'out' ? t.plannedAmount : t.amount} value={amount} onChangeText={setAmount} keyboardType="numeric" />
      {kind === 'out' && (
        <>
          <Field placeholder={t.actualPh} value={actual} onChangeText={setActual} keyboardType="numeric" />
          <Text style={s.hint}>{t.actualHint}</Text>
        </>
      )}
      {error && <Text style={s.error}>{error}</Text>}
      <Button label={t.save} onPress={save} />
      {item && <Button label={t.deleteItem} tone="danger" onPress={onDelete} />}
      <Button label={t.cancel} tone="soft" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  hint: { color: colors.sub, fontSize: 12 },
  error: { color: colors.peachText, backgroundColor: colors.peach, padding: 8, borderRadius: 10, fontSize: 13 },
});
