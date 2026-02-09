import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
// 解析 Markdown 为 Word 段落
const parseMarkdownToWord = (text) => {
    const lines = text.split('\n');
    const paragraphs = [];
    for (const line of lines) {
        if (line.startsWith('# ')) {
            paragraphs.push(new Paragraph({ text: line.substring(2).trim(), heading: HeadingLevel.HEADING_1 }));
        }
        else if (line.startsWith('## ')) {
            paragraphs.push(new Paragraph({ text: line.substring(3).trim(), heading: HeadingLevel.HEADING_2 }));
        }
        else if (line.startsWith('### ')) {
            paragraphs.push(new Paragraph({ text: line.substring(4).trim(), heading: HeadingLevel.HEADING_3 }));
        }
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            paragraphs.push(new Paragraph({ text: line.substring(2).trim(), bullet: { level: 0 } }));
        }
        else if (/^\d+\.\s/.test(line)) {
            paragraphs.push(new Paragraph({ text: line.replace(/^\d+\.\s/, '').trim(), numbering: { level: 0, reference: 'ordered' } }));
        }
        else if (line.startsWith('> ')) {
            paragraphs.push(new Paragraph({ children: [new TextRun({ text: line.substring(2).trim(), italics: true })], indent: { left: 720 } }));
        }
        else if (line.trim()) {
            const children = [];
            let remaining = line;
            while (remaining) {
                if (remaining.startsWith('**') && remaining.indexOf('**', 2) !== -1) {
                    const end = remaining.indexOf('**', 2);
                    children.push(new TextRun({ text: remaining.substring(2, end), bold: true }));
                    remaining = remaining.substring(end + 2);
                }
                else if (remaining.startsWith('*') && remaining.indexOf('*', 1) !== -1 && !remaining.startsWith('**')) {
                    const end = remaining.indexOf('*', 1);
                    children.push(new TextRun({ text: remaining.substring(1, end), italics: true }));
                    remaining = remaining.substring(end + 1);
                }
                else if (remaining.startsWith('`') && remaining.indexOf('`', 1) !== -1) {
                    const end = remaining.indexOf('`', 1);
                    children.push(new TextRun({ text: remaining.substring(1, end), font: 'Courier New', size: 20 }));
                    remaining = remaining.substring(end + 1);
                }
                else {
                    const match = remaining.match(/^([^*`\n]+)/);
                    if (match) {
                        children.push(new TextRun({ text: match[1] }));
                        remaining = remaining.substring(match[1].length);
                    }
                    else
                        break;
                }
            }
            if (children.length > 0) {
                paragraphs.push(new Paragraph({ children }));
            }
        }
    }
    return paragraphs;
};
// 生成 Word blob
const generateWord = async (text) => {
    try {
        const paragraphs = parseMarkdownToWord(text);
        const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
        return await Packer.toBlob(doc);
    }
    catch (error) {
        console.error('Word generation error:', error);
        return null;
    }
};
// 渲染 Markdown 为 HTML
const renderMarkdown = (text) => {
    if (!text.trim())
        return '<p style="color: #999;">Preview will appear here...</p>';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>');
    html = html.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');
    html = html.replace(/\*\*\*\*(.*?)\*\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
    html = html.replace(/`([^`]+)`/g, '<code-inline>$1</code-inline>');
    html = html.replace(/^> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');
    html = html.replace(/^- (.*$)/gim, '<li class="md-li">$1</li>');
    html = html.replace(/^\d+\.\s(.*$)/gim, '<li class="md-li-ordered">$1</li>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-a">$1</a>');
    html = html.replace(/\n\n/g, '</p><p class="md-p">');
    html = '<p class="md-p">' + html + '</p>';
    return html;
};
export const TrueConverter = () => {
    const [markdown, setMarkdown] = useState('# Start writing your Markdown here...\n\n## 这里是标题\n\n这是一段**粗体**文字。\n\n- 列表1\n- 列表2');
    const [wordPreview, setWordPreview] = useState('');
    const [wordBlob, setWordBlob] = useState(null);
    const [isConverting, setIsConverting] = useState(false);
    const [fileName, setFileName] = useState('');
    // 实时更新预览 - 当 markdown 变化时执行
    useEffect(() => {
        // 更新 HTML 预览
        setWordPreview(renderMarkdown(markdown));
        // 生成 Word blob
        generateWord(markdown).then(setWordBlob);
    }, [markdown]);
    // 文件上传
    const handleFileUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setFileName(file.name.replace(/\.(md|markdown)$/i, ''));
        const reader = new FileReader();
        reader.onload = (e) => {
            setMarkdown(e.target?.result);
        };
        reader.readAsText(file);
    };
    // 下载
    const handleDownload = async () => {
        if (!markdown.trim()) {
            alert('Please enter Markdown or upload a file');
            return;
        }
        setIsConverting(true);
        try {
            if (wordBlob) {
                saveAs(wordBlob, fileName ? `${fileName}.docx` : 'converted.docx');
                alert('Downloaded: ' + (fileName ? `${fileName}.docx` : 'converted.docx'));
            }
        }
        catch (error) {
            alert('Error: ' + error);
        }
        finally {
            setIsConverting(false);
        }
    };
    // 加载示例
    const loadSample = () => {
        setMarkdown(`# Sample Document

## Introduction

This is **bold** and *italic* text.

### Features

- List item 1
- List item 2
  - Nested item

> This is a blockquote.

\`\`\`javascript
function hello() {
  console.log("Hello World");
}
\`\`\`
`);
        setFileName('sample');
    };
    return (_jsxs("div", { style: styles.container, children: [_jsxs("header", { style: styles.header, children: [_jsxs("div", { style: styles.headerLeft, children: [_jsx("div", { style: styles.logo, children: "M" }), _jsx("h1", { style: styles.title, children: "Markdown to Word Converter" })] }), _jsx("button", { style: styles.sampleButton, onClick: loadSample, children: "Load sample content" })] }), _jsxs("main", { style: styles.main, children: [_jsx("h2", { style: styles.heroTitle, children: "Free Online Markdown to Word Converter" }), _jsx("p", { style: styles.heroSubtitle, children: "Convert Markdown files to Word documents instantly with real-time preview" }), _jsx("div", { style: styles.editorContainer, children: _jsxs("div", { style: styles.splitContainer, children: [_jsxs("div", { style: styles.panel, children: [_jsx("div", { style: styles.panelHeader, children: _jsxs("div", { style: styles.panelHeaderContent, children: [_jsxs("label", { style: styles.uploadButton, children: [_jsx("span", { children: "\uD83D\uDCC2" }), _jsx("span", { children: "Upload .md file" }), _jsx("input", { type: "file", accept: ".md,.markdown", onChange: handleFileUpload, style: { display: 'none' } })] }), _jsx("span", { style: styles.uploadHint, children: "or edit raw Markdown" })] }) }), _jsx("textarea", { style: styles.textarea, value: markdown, onChange: (e) => setMarkdown(e.target.value), placeholder: "# Start writing your Markdown here..." })] }), _jsxs("div", { style: styles.panel, children: [_jsx("div", { style: styles.panelHeader, children: _jsx("span", { style: styles.panelTitle, children: "Word file preview" }) }), _jsx("div", { style: styles.preview, children: _jsx("div", { className: "word-preview", dangerouslySetInnerHTML: { __html: wordPreview } }) })] })] }) }), _jsx("button", { style: { ...styles.downloadButton, ...((isConverting || !markdown.trim()) ? styles.downloadButtonDisabled : {}) }, onClick: handleDownload, disabled: isConverting || !markdown.trim(), children: isConverting ? 'Converting...' : 'Download Word file' }), _jsxs("div", { style: styles.features, children: [_jsxs("div", { style: styles.featureCard, children: [_jsx("div", { style: { fontSize: '32px', marginBottom: '12px' }, children: "\uD83D\uDD12" }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }, children: "100% Private" }), _jsx("p", { style: { fontSize: '14px', color: '#6b7280' }, children: "All processing done locally" })] }), _jsxs("div", { style: styles.featureCard, children: [_jsx("div", { style: { fontSize: '32px', marginBottom: '12px' }, children: "\u26A1" }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }, children: "Instant Conversion" }), _jsx("p", { style: { fontSize: '14px', color: '#6b7280' }, children: "Real-time preview" })] }), _jsxs("div", { style: styles.featureCard, children: [_jsx("div", { style: { fontSize: '32px', marginBottom: '12px' }, children: "\uD83D\uDCB0" }), _jsx("h3", { style: { fontSize: '16px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }, children: "Completely Free" }), _jsx("p", { style: { fontSize: '14px', color: '#6b7280' }, children: "No registration" })] })] })] }), _jsx("footer", { style: styles.footer, children: _jsx("p", { style: { color: '#6b7280', fontSize: '14px' }, children: "Made with \uD83D\uDC31 Nanami" }) }), _jsx("style", { children: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .word-preview { font-family: -apple-system, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
        .word-preview .md-h1 { font-size: 24px; font-weight: bold; margin: 16px 0 8px; color: #111; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
        .word-preview .md-h2 { font-size: 20px; font-weight: bold; margin: 14px 0 7px; color: #222; }
        .word-preview .md-h3 { font-size: 16px; font-weight: bold; margin: 12px 0 6px; color: #333; }
        .word-preview .md-p { margin: 8px 0; color: #374151; }
        .word-preview .md-li, .word-preview .md-li-ordered { margin: 4px 0; padding-left: 8px; color: #374151; }
        .word-preview .md-blockquote { border-left: 4px solid #9333ea; padding-left: 16px; margin: 12px 0; font-style: italic; color: #6b7280; background: #f9fafb; padding: 12px 0 12px 16px; }
        .word-preview code-inline { background: #f3f4f6; color: #7c3aed; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
        .word-preview .code-block { background: #1f2937; color: #10b981; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; font-family: monospace; font-size: 13px; }
        .word-preview .code-block code { background: none; color: inherit; padding: 0; }
        .word-preview .md-a { color: #2563eb; text-decoration: underline; }
      ` })] }));
};
const styles = {
    container: { minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: '-apple-system, sans-serif' },
    header: { backgroundColor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
    logo: { width: '40px', height: '40px', background: 'linear-gradient(135deg, #9333ea, #ec4899)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px' },
    title: { fontSize: '20px', fontWeight: 600, color: '#1f2937' },
    sampleButton: { padding: '8px 16px', fontSize: '14px', color: '#9333ea', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' },
    main: { maxWidth: '80rem', margin: '0 auto', padding: '32px 24px' },
    heroTitle: { fontSize: '30px', fontWeight: 700, color: '#1f2937', textAlign: 'center', marginBottom: '8px' },
    heroSubtitle: { fontSize: '18px', color: '#6b7280', textAlign: 'center', marginBottom: '32px' },
    editorContainer: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' },
    splitContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #e5e7eb' },
    panel: { display: 'flex', flexDirection: 'column' },
    panelHeader: { padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', minHeight: '48px', display: 'flex', alignItems: 'center' },
    panelHeaderContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    panelTitle: { fontSize: '14px', color: '#6b7280' },
    uploadButton: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' },
    uploadHint: { fontSize: '12px', color: '#9ca3af' },
    textarea: { flex: 1, width: '100%', padding: '16px', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '14px', resize: 'none', border: 'none', outline: 'none', backgroundColor: '#ffffff', color: '#374151', lineHeight: 1.6 },
    preview: { flex: 1, width: '100%', padding: '24px', overflow: 'auto', backgroundColor: '#ffffff' },
    downloadButton: { display: 'block', margin: '32px auto 0', padding: '16px 32px', fontSize: '18px', fontWeight: 600, color: '#ffffff', backgroundColor: '#16a34a', border: 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
    downloadButtonDisabled: { backgroundColor: '#9ca3af', cursor: 'not-allowed' },
    features: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '48px' },
    featureCard: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', border: '1px solid #f3f4f6', textAlign: 'center' },
    footer: { backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb', padding: '24px', marginTop: '48px', textAlign: 'center' },
};
export default TrueConverter;
