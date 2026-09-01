"use client";

// 언어 상태. localStorage 에 저장하고, 없으면 브라우저 설정에서 고른다.
// Context 하나면 충분해서 라이브러리를 쓰지 않는다.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LANG, LANGS, LANG_LABEL, t as translate, type DictKey, type Lang } from "@/lib/i18n";

const KEY = "onlyusdc.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey, vars?: Record<string, string | number>) => string };
const LangCtx = createContext<Ctx>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k) => k as string });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && (LANGS as readonly string[]).includes(saved)) { setLangState(saved); return; }
    // 저장값이 없으면 브라우저 언어를 따른다
    if (navigator.language?.toLowerCase().startsWith("ko")) setLangState("ko");
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (k: DictKey, vars?: Record<string, string | number>) => translate(k, lang, vars),
    [lang],
  );

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang(): Ctx {
  return useContext(LangCtx);
}

/** 언어 토글. 두 개뿐이라 드롭다운 대신 버튼 두 개가 빠르다. */
export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <span className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === lang ? "lang-on" : ""}
          onClick={() => setLang(l)}
          aria-pressed={l === lang}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </span>
  );
}
