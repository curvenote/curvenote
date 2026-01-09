export { EditorView } from '@codemirror/view';
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
  EditorView,
} from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
  indentUnit,
} from '@codemirror/language';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import {
  closeBrackets,
  autocompletion,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import type { Diagnostic } from '@codemirror/lint';
import { lintKeymap, linter } from '@codemirror/lint';
import { json as jsonLang, jsonParseLinter } from '@codemirror/lang-json';
import { yaml as yamlLang } from '@codemirror/lang-yaml';
import { useEffect, useRef, useState } from 'react';
import { load } from 'js-yaml';

function yamlLinter(view: EditorView) {
  const diagnostics: Diagnostic[] = [];

  try {
    load(view.state.doc.toString());
  } catch (e: any) {
    const loc = e.mark;
    const from = loc ? loc.position : 0;
    const to = from;
    const severity = 'error';

    diagnostics.push({
      from,
      to,
      message: e.message,
      severity,
    });
  }

  return diagnostics;
}

export function useEditor(initialState: string, lang: 'json' | 'yaml' = 'json') {
  const [doc, setDoc] = useState(initialState);
  const ref = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<EditorView>();

  const languageExtension = lang === 'json' ? jsonLang : yamlLang;
  const linterExtension = lang === 'json' ? linter(jsonParseLinter()) : linter(yamlLinter);

  useEffect(() => {
    if (view)
      return () => {
        view.destroy();
        setView(undefined);
      };

    const v = new EditorView({
      doc,
      extensions: [
        [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          indentUnit.of('  '), // 2 spaces
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          linterExtension,
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap,
            indentWithTab,
          ]),
        ],
        languageExtension(),
      ],
      parent: ref.current ?? undefined,
    });

    setView(v);

    return () => {
      v.destroy();
      setView(undefined);
    };
  }, []);

  return { doc, setDoc, ref, view, setView };
}
