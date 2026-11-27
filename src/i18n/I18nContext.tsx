import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dict, Lang, dictionaries, setCurrentLang } from './strings';

const KEY = 'app_language';

type Ctx = {
  lang: Lang;
  t: Dict;
  chosen: boolean; // false until the person picks a language on first launch
  ready: boolean;
  setLang: (l: Lang) => Promise<void>;
};

const I18nCtx = createContext<Ctx | null>(null);

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('useI18n must be used inside I18nProvider');
  return c;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'en' || v === 'my') {
          setLangState(v);
          setCurrentLang(v);
          setChosen(true);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    setCurrentLang(l);
    setChosen(true);
    await AsyncStorage.setItem(KEY, l);
  }, []);

  const value = useMemo(() => ({ lang, t: dictionaries[lang], chosen, ready, setLang }), [lang, chosen, ready, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
