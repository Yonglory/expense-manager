import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { parseAmount } from '../lib/format';
import type { Item, Kind } from '../lib/types';
import { Button, Field } from './ui';

type Props = {
  visible: boolean;
  kind: Kind;
  item: Item | null; // null = adding
  onClose: () => void;
  onSave: (name: string, amount: number) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

export function ItemModal({ visible, kind, item, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(item?.name ?? '');
      setAmount(item ? String(item.amount) : '');
      setError(null);
    }
  }, [visible, item]);

  const save = async () => {
    if (!name.trim()) return setError('Give this item a name.');
    await onSave(name.trim(), parseAmount(amount));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <Text style={s.title}>
            {item ? 'Edit item' : kind === 'out' ? 'Add to Money out' : 'Add to Money in'}
          </Text>
          <Field placeholder="Name, for example Groceries" value={name} onChangeText={setName} autoFocus />
          <Field placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
          {error && <Text style={s.error}>{error}</Text>}
          <Button label="Save" onPress={save} />
          {item && <Button label="Delete item" tone="danger" onPress={onDelete} />}
          <Button label="Cancel" tone="soft" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(43,58,74,0.35)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 10, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 4 },
  error: { color: colors.peachText, backgroundColor: colors.peach, padding: 8, borderRadius: 10, fontSize: 13 },
});
