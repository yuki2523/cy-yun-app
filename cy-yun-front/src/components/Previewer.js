import { useEffect } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/default.css';

marked.setOptions({
  highlight: (code) => hljs.highlightAuto(code).value,
});

const Previewer = ({ content }) => {
  useEffect(() => {
    hljs.highlightAll();
  }, [content]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        padding: '1rem',
        overflowY: 'auto',
        backgroundColor: '#fff',
        fontSize: 18,
      }}
      className="w-full h-full"
      dangerouslySetInnerHTML={{ __html: marked(content) }}
    />
  );
};

export default Previewer;