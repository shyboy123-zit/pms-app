import sys

# Read the original file
with open(r'c:\Users\kimhj\OneDrive\바탕 화면\앱개발\pms-app\src\pages\Dashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the closing tags
closing_div_index = content.rfind('</div>\r\n    );\r\n};')

if closing_div_index == -1:
    closing_div_index = content.rfind('</div>\n    );\n};')

if closing_div_index == -1:
    print("Error: Could not find closing tags")
    sys.exit(1)

# Insert modal before the closing div
modal_jsx = '''
            {/* 사출조건 모달 */}
            <Modal
                title="사출조건 정보"
                isOpen={isConditionModalOpen}
                onClose={() => setIsConditionModalOpen(false)}
                width="800px"
            >
                {selectedCondition && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.75rem', fontWeight: 700 }}>사출 조건</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.9rem' }}>
                                {selectedCondition.injection_pressure && (
                                    <div>
                                        <div style={{ color: '#64748b' }}>사출압력</div>
                                        <div style={{ fontWeight: 700, color: '#4f46e5' }}>{selectedCondition.injection_pressure} kgf/cm²</div>
                                    </div>
                                )}
                                {selectedCondition.cycle_time && (
                                    <div>
                                        <div style={{ color: '#64748b' }}>사이클 타임</div>
                                        <div style={{ fontWeight: 700, color: '#4f46e5' }}>{selectedCondition.cycle_time}초</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedCondition.notes && (
                            <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>비고</div>
                                <div style={{ fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedCondition.notes}</div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
'''

new_content = content[:closing_div_index] + modal_jsx + content[closing_div_index:]

# Write the modified content
with open(r'c:\Users\kimhj\OneDrive\바탕 화면\앱개발\pms-app\src\pages\Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Success: Modal added to Dashboard.jsx")
# Write the modified content
with open(r'c:\Users\kimhj\OneDrive\바탕 화면\앱개발\pms-app\src\pages\Dashboard.jsx', 'w', encoding='utf-8-sig') as f:
    f.write(new_content)

print("Success: Modal added to Dashboard.jsx")
