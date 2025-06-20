import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

const Editor = ({ value, onChange, language = 'markdown' }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) {
      editorRef.current = monaco.editor.create(document.getElementById('editor'), {
        value: value,
        language: language,
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 18,
      });

      const editorInstance = editorRef.current;
      editorInstance.onDidChangeModelContent(() => {
        onChange(editorInstance.getValue());
      });
    }
  }, [value, language]);

  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model && model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return <div id="editor" style={{ width: '100%', height: '100%' }} />;
};

export default Editor;