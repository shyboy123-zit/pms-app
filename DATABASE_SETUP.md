# 데이터베이스 설정 가이드

## 개요
이 문서는 재고관리 시스템 개선을 위해 필요한 새로운 데이터베이스 테이블 설정 방법을 안내합니다.

## 사전 준비사항
- Supabase 프로젝트 대시보드 접근 권한
- Supabase SQL 편집기 사용 권한

## 설정 단계

### 1단계: Supabase SQL 편집기 열기
1. https://supabase.com 에서 로그인하세요
2. PMS 프로젝트를 선택하세요
3. 왼쪽 사이드바에서 **SQL Editor** (SQL 편집기)를 클릭하세요
4. **New Query** (새 쿼리) 버튼을 클릭하세요

### 2단계: 스키마 스크립트 실행
1. 프로젝트 루트 폴더에 있는 `database_schema.sql` 파일을 여세요
2. 전체 SQL 스크립트를 복사하세요
3. Supabase SQL 편집기에 붙여넣으세요
4. **Run** (실행) 버튼을 클릭하거나 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)를 누르세요

### 3단계: 테이블 생성 확인
스크립트 실행 후, 테이블이 생성되었는지 확인하세요:

1. Supabase에서 **Table Editor** (테이블 편집기)로 이동하세요
2. 다음 2개의 새 테이블이 보여야 합니다:
   - `material_usage` (원재료 사용 내역)
   - `inventory_transactions` (입출고 거래 내역)

### 4단계: Row Level Security (RLS) 확인
스크립트는 자동으로 RLS를 활성화하고 인증된 사용자를 위한 정책을 생성합니다. 확인 방법:

1. 테이블 편집기에서 각 테이블을 클릭하세요
2. **Policies** (정책) 탭으로 이동하세요
3. 정책이 활성화되어 있는지 확인하세요

## 테이블 설명

### `material_usage` (원재료 사용 내역)
작업에 투입된 원재료 소비 내역을 추적합니다.

**컬럼:**
- `id`: 기본 키
- `material_id`: materials 테이블 참조 외래 키
- `material_name`: 사용된 자재명
- `quantity`: 소비량
- `unit`: 측정 단위
- `work_order`: 작업지시번호 (선택사항)
- `usage_date`: 자재 사용 일자
- `notes`: 메모 (선택사항)
- `created_at`: 생성 시간
- `created_by`: 생성한 사용자

### `inventory_transactions` (입출고 거래 내역)
모든 재고 이동(입고/출고)을 가격 정보와 함께 추적합니다.

**컬럼:**
- `id`: 기본 키
- `transaction_type`: 거래 유형 ('IN' 또는 'OUT')
- `item_name`: 제품명
- `item_code`: 제품 코드 (선택사항)
- `quantity`: 거래 수량
- `unit`: 측정 단위 (기본값: EA)
- `unit_price`: 단가
- `total_amount`: 자동 계산 (수량 × 단가)
- `transaction_date`: 거래 일자
- `client`: 고객사 또는 공급사명
- `notes`: 메모 (선택사항)
- `created_at`: 생성 시간
- `created_by`: 생성한 사용자
- `updated_at`: 마지막 수정 시간

## 설정 테스트

테이블 생성 후, 샘플 데이터로 테스트할 수 있습니다:

```sql
-- material_usage 테스트 (id=1인 자재가 있다고 가정)
INSERT INTO material_usage (material_id, material_name, quantity, unit, usage_date)
VALUES (1, '플라스틱 원료', 50, 'kg', CURRENT_DATE);

-- inventory_transactions 테스트
INSERT INTO inventory_transactions (
  transaction_type, item_name, item_code, quantity, unit, unit_price, transaction_date, client
)
VALUES 
  ('IN', '볼 조인트 베어링 A형', 'BJB-001', 100, 'EA', 5000, CURRENT_DATE, '공급사 A'),
  ('OUT', '볼 조인트 베어링 A형', 'BJB-001', 50, 'EA', 5000, CURRENT_DATE, '현대자동차');
```

## 문제 해결

### 오류: "relation already exists" (테이블이 이미 존재합니다)
이 오류가 발생하면 테이블이 이미 존재하는 것입니다. 다음 중 하나를 선택하세요:
- 기존 테이블 삭제: `DROP TABLE material_usage, inventory_transactions;`
- 또는 스크립트의 `CREATE TABLE`을 `CREATE TABLE IF NOT EXISTS`로 수정

### 오류: "permission denied" (권한 거부)
데이터베이스 소유자로 스크립트를 실행하거나 충분한 권한이 있는지 확인하세요.

### RLS 정책이 작동하지 않음
데이터가 표시되지 않으면:
1. 테이블에 RLS가 활성화되어 있는지 확인
2. 인증이 제대로 작동하는지 확인
3. 정책 조건이 인증 설정과 일치하는지 확인

## 다음 단계

데이터베이스 설정이 완료되면:
1. 개발 서버 재시작: `npm run dev`
2. Materials 페이지에서 원재료 사용 기능 테스트
3. 입출고 관리 페이지에서 거래 등록 테스트
4. 날짜 범위 필터가 올바르게 작동하는지 확인

## 지원

문제가 발생하면:
- Supabase 대시보드에서 로그 확인
- 브라우저 콘솔에서 오류 확인
- `.env` 파일의 환경 변수 확인
- Supabase 클라이언트가 올바르게 구성되었는지 확인

---

**중요:** 이 설정은 한 번만 실행하면 됩니다. 테이블이 생성된 후에는 애플리케이션이 자동으로 데이터를 로드합니다.
