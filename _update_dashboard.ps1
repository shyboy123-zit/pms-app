$content = Get-Content "c:\Users\kimhj\OneDrive\바탕 화면\앱개발\pms-app\src\pages\Dashboard.jsx" -Raw -Encoding UTF8

# Replace the onClick handler with debug version
$oldHandler = @'
                                            onClick={() => {
                                                const condition = injectionConditions.find(
                                                    c => c.product_id === workOrder.product_id && c.equipment_id === eq.id
                                                );
                                                if (condition) {
                                                    setSelectedCondition(condition);
                                                    setIsConditionModalOpen(true);
                                                } else {
                                                    alert('해당 제품-호기 조합의 사출조건이 등록되지 않았습니다.');
                                                }
                                            }}
'@

$newHandler = @'
                                            onClick={() => {
                                                console.log('=== 호기 클릭됨! ===');
                                                console.log('workOrder:', workOrder);
                                                console.log('eq:', eq);
                                                if (!workOrder) {
                                                    alert('작업지시 정보를 찾을 수 없습니다.');
                                                    return;
                                                }
                                                const condition = injectionConditions.find(
                                                    c => c.product_id === workOrder.product_id && c.equipment_id === eq.id
                                                );
                                                console.log('찾은 사출조건:', condition);
                                                if (condition) {
                                                    console.log('모달 열기!');
                                                    setSelectedCondition(condition);
                                                    setIsConditionModalOpen(true);
                                                } else {
                                                    alert('해당 제품-호기 조합의 사출조건이 등록되지 않았습니다.');
                                                }
                                            }}
'@

$newContent = $content -replace [regex]::Escape($oldHandler), $newHandler
Set-Content "c:\Users\kimhj\OneDrive\바탕 화면\앱개발\pms-app\src\pages\Dashboard.jsx" -Value $newContent -Encoding UTF8
Write-Host "Dashboard.jsx updated with debug logging"
