/**
 * Excel 유틸리티 — 가져오기/내보내기 헬퍼
 *
 * 모든 데이터 페이지에서 동일한 패턴으로 사용 가능:
 *   exportToExcel(데이터배열, 컬럼정의, '파일명')
 *   importFromExcel(File, 컬럼정의) → Promise<데이터배열>
 */
import * as XLSX from 'xlsx';

/**
 * 데이터를 엑셀 파일로 내보내기
 *
 * @param {Array<Object>} data    - 행 데이터 배열
 * @param {Array<{key, label, format?}>} columns - 컬럼 정의
 *                                  format(value, row) → 표시할 값 (선택)
 * @param {string} fileName       - 파일명 (확장자 없이)
 * @param {string} sheetName      - 시트 이름 (기본: 'Sheet1')
 */
export function exportToExcel(data, columns, fileName, sheetName = 'Sheet1') {
    if (!data || data.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    // 컬럼 헤더와 데이터를 변환
    const headers = columns.map(c => c.label);
    const rows = data.map(row =>
        columns.map(c => {
            const raw = row[c.key];
            if (c.format) return c.format(raw, row);
            if (raw === null || raw === undefined) return '';
            return raw;
        })
    );

    const sheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // 컬럼 너비 자동 (각 컬럼의 최대 길이 기반)
    const colWidths = columns.map((c, i) => {
        const maxLen = Math.max(
            String(c.label).length,
            ...rows.map(r => String(r[i] ?? '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${today}.xlsx`);
}

/**
 * 빈 템플릿 다운로드 (가져오기용 양식)
 *
 * @param {Array<{key, label, sample?}>} columns
 * @param {string} fileName
 */
export function downloadTemplate(columns, fileName) {
    const headers = columns.map(c => c.label);
    const sampleRow = columns.map(c => c.sample ?? '');

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    ws['!cols'] = columns.map(c => ({ wch: Math.max(c.label.length + 2, 12) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '템플릿');
    XLSX.writeFile(wb, `${fileName}_템플릿.xlsx`);
}

/**
 * 엑셀 파일에서 데이터 읽기
 *
 * @param {File} file - input[type=file]의 선택된 파일
 * @param {Array<{key, label, parse?}>} columns - 헤더 매핑
 *                                                 parse(value) → 변환된 값 (선택, 숫자/날짜 변환 등)
 * @returns {Promise<Array<Object>>} - 행 객체 배열
 */
export function importFromExcel(file, columns) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                if (aoa.length < 2) {
                    return reject(new Error('데이터가 없습니다. 헤더 행과 데이터 행을 모두 포함하세요.'));
                }

                const headerRow = aoa[0].map(h => String(h).trim());

                // 라벨 → key 매핑 생성
                const labelToKey = {};
                columns.forEach(c => { labelToKey[c.label] = c; });

                // 헤더 인덱스 → 컬럼 정의 매핑
                const colMap = headerRow.map(h => labelToKey[h] || null);

                // 모든 헤더가 알려진 라벨이 아닌 경우 경고
                const unknownHeaders = headerRow.filter(h => !labelToKey[h]);
                if (unknownHeaders.length > 0) {
                    console.warn('알 수 없는 컬럼은 무시됩니다:', unknownHeaders);
                }

                const rows = [];
                for (let i = 1; i < aoa.length; i++) {
                    const row = aoa[i];
                    if (!row || row.every(v => v === '' || v === null || v === undefined)) continue;
                    const obj = {};
                    colMap.forEach((col, idx) => {
                        if (!col) return;
                        const raw = row[idx];
                        obj[col.key] = col.parse ? col.parse(raw) : raw;
                    });
                    rows.push(obj);
                }

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsArrayBuffer(file);
    });
}

// 자주 쓰는 parse 함수들
export const parsers = {
    number: (v) => {
        if (v === '' || v === null || v === undefined) return 0;
        const n = Number(String(v).replace(/[,\s]/g, ''));
        return isNaN(n) ? 0 : n;
    },
    string: (v) => v === null || v === undefined ? '' : String(v).trim(),
    date: (v) => {
        if (!v) return null;
        // 엑셀 직렬 날짜 (number) → 변환
        if (typeof v === 'number') {
            const d = XLSX.SSF.parse_date_code(v);
            if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
        // 이미 문자열인 경우 — YYYY-MM-DD 형태 보장
        const s = String(v).trim();
        const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        return s;
    }
};
