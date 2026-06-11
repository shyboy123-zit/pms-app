import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
    const { user } = useAuth() || {};

    // ============================================================
    // 감사 로그 (audit_log) 자동 기록 헬퍼
    // ------------------------------------------------------------
    // 모든 주요 데이터 변경(INSERT/UPDATE/DELETE)을 audit_log 테이블에
    // 자동 기록한다. 실패해도 메인 로직은 영향받지 않도록 silent fail.
    // ============================================================
    const logAudit = async ({
        tableName,
        recordId,
        action,        // 'INSERT' | 'UPDATE' | 'DELETE'
        oldData = null,
        newData = null,
        reason = null,
        context = null
    }) => {
        try {
            await supabase.from('audit_log').insert([{
                table_name: tableName,
                record_id: recordId != null ? String(recordId) : null,
                action,
                old_data: oldData,
                new_data: newData,
                changed_by_id: user?.auth_user_id || null,
                changed_by_name: user?.name || user?.email || 'unknown',
                reason,
                context
            }]);
        } catch (e) {
            // 감사 로그 실패는 메인 트랜잭션을 막지 않음 (테이블 없을 수도 있음)
            console.warn('[audit_log] silent fail:', e?.message);
        }
    };
    // --- State ---
    const [loading, setLoading] = useState(true);
    const [molds, setMolds] = useState([]);
    const [repairHistory, setRepairHistory] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [eqHistory, setEqHistory] = useState([]);
    const [inspections, setInspections] = useState([]);
    const [employees, setEmployees] = useState([]); // Moved employees here
    const [materialUsage, setMaterialUsage] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseRequests, setPurchaseRequests] = useState([]);
    const [inventoryTransactions, setInventoryTransactions] = useState([]);
    const [moldMovement, setMoldMovement] = useState([]);
    const [products, setProducts] = useState([]);
    const [workOrders, setWorkOrders] = useState([]);
    const [salesRecords, setSalesRecords] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [injectionConditions, setInjectionConditions] = useState([]);
    const [productionLogs, setProductionLogs] = useState([]);
    const [boardPosts, setBoardPosts] = useState([]);
    const [boardComments, setBoardComments] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [vouchers, setVouchers] = useState([]);

    // --- Fetch ALL Data ---
    const fetchAllData = async () => {
        try {
            setLoading(true);
            const { data: m } = await supabase.from('molds').select('*').order('created_at', { ascending: true });
            if (m) setMolds(m);

            const { data: mh } = await supabase.from('mold_history').select('*').order('created_at', { ascending: false });
            if (mh) setRepairHistory(mh);

            const { data: mat } = await supabase.from('materials').select('*').order('created_at', { ascending: true });
            if (mat) setMaterials(mat);

            const { data: eq } = await supabase.from('equipments').select('*').order('eq_code', { ascending: true });
            if (eq) setEquipments(eq);

            const { data: eqh } = await supabase.from('equipment_history').select('*').order('created_at', { ascending: false });
            if (eqh) setEqHistory(eqh);

            const { data: insp } = await supabase.from('inspections').select('*').order('created_at', { ascending: false });
            if (insp) setInspections(insp);

            const { data: emp } = await supabase.from('employees').select('*').order('created_at', { ascending: true });
            if (emp) setEmployees(emp);

            // Fetch Suppliers
            const { data: suppliersData } = await supabase
                .from('suppliers')
                .select('*')
                .order('name', { ascending: true });
            if (suppliersData) setSuppliers(suppliersData);

            // Fetch Purchase Requests
            const { data: requestsData } = await supabase
                .from('purchase_requests')
                .select('*')
                .order('created_at', { ascending: false });
            if (requestsData) setPurchaseRequests(requestsData);

            // Optional tables - fail silently if not exist
            try {
                const { data: usage } = await supabase.from('material_usage').select('*').order('usage_date', { ascending: false });
                if (usage) setMaterialUsage(usage);
            } catch (e) {
                console.warn('material_usage table not available:', e.message);
            }

            try {
                const { data: trans } = await supabase.from('inventory_transactions').select('*').order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
                if (trans) setInventoryTransactions(trans);
            } catch (e) {
                console.warn('inventory_transactions table not available:', e.message);
            }

            try {
                const { data: movements } = await supabase.from('mold_movement').select('*').order('outgoing_date', { ascending: false });
                if (movements) setMoldMovement(movements);
            } catch (e) {
                console.warn('mold_movement table not available:', e.message);
            }

            try {
                const { data: prods } = await supabase.from('products').select('*').order('created_at', { ascending: true });
                if (prods) setProducts(prods);
            } catch (e) {
                console.warn('products table not available:', e.message);
            }

            try {
                const { data: orders } = await supabase.from('work_orders').select('*').order('created_at', { ascending: false });
                if (orders) setWorkOrders(orders);
            } catch (e) {
                console.warn('work_orders table not available:', e.message);
            }

            try {
                const { data: sales } = await supabase.from('sales_records').select('*').order('date', { ascending: false });
                if (sales) setSalesRecords(sales);
            } catch (e) {
                console.warn('sales_records table not available:', e.message);
            }

            try {
                const { data: notifs } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
                if (notifs) setNotifications(notifs);
            } catch (e) {
                console.warn('notifications table not available:', e.message);
            }

            try {
                const { data: conditions } = await supabase.from('injection_conditions').select('*').order('created_at', { ascending: false });
                if (conditions) setInjectionConditions(conditions);
            } catch (e) {
                console.warn('injection_conditions table not available:', e.message);
            }

            try {
                const { data: logs } = await supabase.from('production_logs').select('*').order('production_date', { ascending: false });
                if (logs) setProductionLogs(logs);
            } catch (e) {
                console.warn('production_logs table not available:', e.message);
            }

            try {
                const { data: posts } = await supabase.from('board_posts').select('*').order('created_at', { ascending: false });
                if (posts) setBoardPosts(posts);
            } catch (e) {
                console.warn('board_posts table not available:', e.message);
            }

            try {
                const { data: comments } = await supabase.from('board_comments').select('*').order('created_at', { ascending: true });
                if (comments) setBoardComments(comments);
            } catch (e) {
                console.warn('board_comments table not available:', e.message);
            }

            try {
                const { data: att } = await supabase.from('attendance').select('*').order('date', { ascending: false });
                if (att) setAttendance(att);
            } catch (e) {
                console.warn('attendance table not available:', e.message);
            }

            try {
                const { data: pr } = await supabase.from('payroll_records').select('*').order('created_at', { ascending: false });
                if (pr) setPayrollRecords(pr);
            } catch (e) {
                console.warn('payroll_records table not available:', e.message);
            }

            try {
                const { data: v } = await supabase.from('vouchers').select('*').order('voucher_date', { ascending: false });
                if (v) setVouchers(v);
            } catch (e) {
                console.warn('vouchers table not available:', e.message);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // 자동 알림 체크 — 로그인된 사용자가 있고 핵심 데이터 로딩이 끝났을 때 1회 실행
    // (페이지 새로고침 시마다 호출되지만, 같은 키 알림이 오늘 이미 있으면 스킵됨)
    useEffect(() => {
        if (loading) return;
        if (!user?.id) return;
        // 데이터 형태 보장 + 다른 상태 변경마다 재실행 방지 위해 setTimeout 0ms로 마이크로태스크 큐 이후 실행
        const timer = setTimeout(() => {
            runNotificationChecks(user.id).catch(e => console.warn('[notification-check] failed:', e?.message));
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, user?.id]);

    // --- Actions (CRUD) ---

    // 1. Molds
    const addMold = async (item) => {
        const { data, error } = await supabase.from('molds').insert([item]).select();
        if (!error && data) setMolds([...molds, data[0]]);
    };
    const updateMold = async (id, fields) => {
        const { error } = await supabase.from('molds').update(fields).eq('id', id);
        if (!error) setMolds(molds.map(m => m.id === id ? { ...m, ...fields } : m));
    };
    const deleteMold = async (id) => {
        // 자식 레코드(수리이력)를 먼저 삭제 — mold_history FK는 CASCADE가 아니라
        // 이력이 남아 있으면 금형 삭제가 막힌다. (mold_movement는 ON DELETE CASCADE라 자동 삭제)
        await supabase.from('mold_history').delete().eq('mold_id', id);
        const { error } = await supabase.from('molds').delete().eq('id', id);
        if (!error) {
            setMolds(molds.filter(m => m.id !== id));
            setRepairHistory(prev => prev.filter(h => h.mold_id !== id));
            setMoldMovement(prev => prev.filter(mv => mv.mold_id !== id));
        }
        return { error };
    };

    // 2. Mold History
    const addMoldHistory = async (item) => {
        const { data, error } = await supabase.from('mold_history').insert([item]).select();
        if (!error && data) setRepairHistory([data[0], ...repairHistory]);
    };

    const deleteMoldHistory = async (id) => {
        const { error } = await supabase.from('mold_history').delete().eq('id', id);
        if (!error) {
            setRepairHistory(repairHistory.filter(h => h.id !== id));
        }
        return { error };
    };

    // 3. Materials
    const addMaterial = async (item) => {
        const { data, error } = await supabase.from('materials').insert([item]).select();
        if (!error && data) setMaterials([...materials, data[0]]);
    };
    const updateMaterial = async (id, fields) => { // e.g., updates stock
        const { error } = await supabase.from('materials').update(fields).eq('id', id);
        if (!error) setMaterials(materials.map(m => m.id === id ? { ...m, ...fields } : m));
    };
    const deleteMaterial = async (id) => {
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (!error) setMaterials(materials.filter(m => m.id !== id));
    };

    // 4. Equipments
    const addEquipment = async (item) => {
        const { data, error } = await supabase.from('equipments').insert([item]).select();
        if (!error && data) setEquipments([...equipments, data[0]]);
    };
    const updateEquipment = async (id, fields) => {
        const { error } = await supabase.from('equipments').update(fields).eq('id', id);
        if (!error) setEquipments(equipments.map(e => e.id === id ? { ...e, ...fields } : e));
    };
    const deleteEquipment = async (id) => {
        const { error } = await supabase.from('equipments').delete().eq('id', id);
        if (!error) setEquipments(equipments.filter(e => e.id !== id));
        return { error };
    };

    // 5. Equipment History
    const addEqHistory = async (item) => {
        const { data, error } = await supabase.from('equipment_history').insert([item]).select();
        if (!error && data) setEqHistory([data[0], ...eqHistory]);
    };
    const deleteEqHistory = async (id) => {
        const { error } = await supabase.from('equipment_history').delete().eq('id', id);
        if (!error) setEqHistory(eqHistory.filter(h => h.id !== id));
        return { error };
    };

    // 6. Inspections (Quality)
    const addInspection = async (item) => {
        const { data, error } = await supabase.from('inspections').insert([item]).select();
        if (!error && data) setInspections([data[0], ...inspections]);
    };
    const updateInspection = async (id, fields) => {
        const { error } = await supabase.from('inspections').update(fields).eq('id', id);
        if (!error) setInspections(inspections.map(i => i.id === id ? { ...i, ...fields } : i));
    };
    const deleteInspection = async (id) => {
        const { error } = await supabase.from('inspections').delete().eq('id', id);
        if (!error) setInspections(inspections.filter(i => i.id !== id));
    };

    // 7. Employees
    const addEmployee = async (item) => {
        const { data, error } = await supabase.from('employees').insert([item]).select();
        if (!error && data) setEmployees([...employees, data[0]]);
    };
    const updateEmployee = async (id, fields) => {
        const { error } = await supabase.from('employees').update(fields).eq('id', id);
        if (error) throw new Error(error.message);
        setEmployees(employees.map(e => e.id === id ? { ...e, ...fields } : e));
    };
    const deleteEmployee = async (id) => {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (!error) setEmployees(employees.filter(e => e.id !== id));
    };

    // 8. Material Usage
    const addMaterialUsage = async (item) => {
        const { data, error } = await supabase.from('material_usage').insert([item]).select();
        if (error) {
            console.error('material_usage insert error:', error);
        }

        if (!error) {
            // Refetch all material_usage to ensure consistency
            const { data: refreshed } = await supabase.from('material_usage').select('*').order('usage_date', { ascending: false });
            if (refreshed) setMaterialUsage(refreshed);

            // Update material stock
            if (item.material_id) {
                const material = materials.find(m => m.id === item.material_id);
                if (material) {
                    const newStock = material.stock - item.quantity;
                    await updateMaterial(item.material_id, { stock: newStock });
                }
            }
        }

        return { data, error };
    };

    const getMaterialUsageHistory = async (materialId) => {
        const { data } = await supabase
            .from('material_usage')
            .select('*')
            .eq('material_id', materialId)
            .order('usage_date', { ascending: false });
        return data || [];
    };

    const updateMaterialUsage = async (id, oldQuantity, fields) => {
        const { error } = await supabase.from('material_usage').update(fields).eq('id', id);
        if (!error) {
            setMaterialUsage(materialUsage.map(u => u.id === id ? { ...u, ...fields } : u));

            // Adjust material stock if quantity changed
            if (fields.quantity !== undefined && fields.material_id) {
                const material = materials.find(m => m.id === fields.material_id);
                if (material) {
                    // Add back old quantity and subtract new quantity
                    const stockAdjustment = oldQuantity - fields.quantity;
                    const newStock = material.stock + stockAdjustment;
                    await updateMaterial(fields.material_id, { stock: newStock });
                }
            }
        }
        return { error };
    };

    const deleteMaterialUsage = async (usageId, materialId, qty) => {
        // 1. Restore stock
        const material = materials.find(m => m.id === materialId);
        if (material) {
            await updateMaterial(materialId, { stock: material.stock + parseFloat(qty) });
        }
        // 2. Delete usage record
        const { error } = await supabase.from('material_usage').delete().eq('id', usageId);
        if (!error) {
            setMaterialUsage(materialUsage.filter(u => u.id !== usageId));
        }
        return { error };
    };

    // 9. Inventory Transactions
    const addInventoryTransaction = async (item, auditMeta = {}) => {
        const { data, error } = await supabase.from('inventory_transactions').insert([item]).select();
        if (!error && data) {
            setInventoryTransactions(prev => [data[0], ...prev]);
            logAudit({
                tableName: 'inventory_transactions',
                recordId: data[0].id,
                action: 'INSERT',
                newData: data[0],
                reason: auditMeta.reason || null,
                context: auditMeta.context || 'inventory:add'
            });
        }
        return { data, error };
    };

    const updateInventoryTransaction = async (id, fields, auditMeta = {}) => {
        // 변경 전 데이터 스냅샷 (감사 로그용)
        const oldRow = inventoryTransactions.find(t => t.id === id) || null;
        const { error } = await supabase.from('inventory_transactions').update(fields).eq('id', id);
        if (!error) {
            setInventoryTransactions(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
            logAudit({
                tableName: 'inventory_transactions',
                recordId: id,
                action: 'UPDATE',
                oldData: oldRow,
                newData: { ...(oldRow || {}), ...fields },
                reason: auditMeta.reason || null,
                context: auditMeta.context || 'inventory:update'
            });
        }
    };

    const deleteInventoryTransaction = async (id, auditMeta = {}) => {
        const oldRow = inventoryTransactions.find(t => t.id === id) || null;
        const { error } = await supabase.from('inventory_transactions').delete().eq('id', id);
        if (!error) {
            setInventoryTransactions(prev => prev.filter(t => t.id !== id));
            logAudit({
                tableName: 'inventory_transactions',
                recordId: id,
                action: 'DELETE',
                oldData: oldRow,
                reason: auditMeta.reason || null,
                context: auditMeta.context || 'inventory:delete'
            });
        }
    };

    const getTransactionsByDateRange = async (startDate, endDate) => {
        let query = supabase.from('inventory_transactions').select('*');

        if (startDate) query = query.gte('transaction_date', startDate);
        if (endDate) query = query.lte('transaction_date', endDate);

        const { data } = await query.order('transaction_date', { ascending: false });
        return data || [];
    };

    // Historical queries
    const getInventorySnapshot = async (targetDate) => {
        // Get all transactions up to target date
        const { data } = await supabase
            .from('inventory_transactions')
            .select('*')
            .lte('transaction_date', targetDate)
            .order('transaction_date', { ascending: false });

        // Calculate stock by item (item_name 기준 그룹핑)
        const stockByItem = {};
        if (data) {
            data.reverse().forEach(trans => {
                const key = trans.item_name;
                if (!key) return;
                if (!stockByItem[key]) {
                    stockByItem[key] = {
                        itemName: trans.item_name,
                        itemCode: trans.item_code,
                        stock: 0,
                        unit: trans.unit
                    };
                }
                if (trans.item_code && !stockByItem[key].itemCode) {
                    stockByItem[key].itemCode = trans.item_code;
                }

                if (trans.transaction_type === 'IN' || trans.transaction_type === 'ADJUST') {
                    stockByItem[key].stock += parseFloat(trans.quantity);
                } else if (trans.transaction_type === 'OUT') {
                    stockByItem[key].stock -= parseFloat(trans.quantity);
                }
            });
        }

        return Object.values(stockByItem);
    };

    const getMaterialStockAtDate = async (materialId, targetDate) => {
        // Get material's initial stock and all usage up to target date
        const { data: usageData } = await supabase
            .from('material_usage')
            .select('*')
            .eq('material_id', materialId)
            .lte('usage_date', targetDate);

        const material = materials.find(m => m.id === materialId);
        if (!material) return null;

        let stockAtDate = material.stock;
        if (usageData) {
            usageData.forEach(usage => {
                stockAtDate += parseFloat(usage.quantity); // Add back the usage to get historical stock
            });
        }

        return stockAtDate;
    };

    // 10. Mold Movement (Outgoing/Incoming)
    const addMoldOutgoing = async (item) => {
        // Check if mold is already out
        const existingOutgoing = moldMovement.find(
            m => m.mold_id === item.mold_id && m.status === '출고중'
        );

        if (existingOutgoing) {
            alert('이미 출고 중인 금형입니다.');
            return { data: null, error: 'Already outgoing' };
        }

        const { data, error } = await supabase.from('mold_movement').insert([{
            mold_id: item.mold_id,
            movement_type: '출고',
            outgoing_date: item.outgoing_date,
            destination: item.destination,
            repair_vendor: item.repair_vendor,
            expected_return_date: item.expected_return_date,
            outgoing_reason: item.outgoing_reason,
            responsible_person: item.responsible_person,
            status: '출고중',
            notes: item.notes
        }]).select();

        if (!error && data) {
            setMoldMovement([data[0], ...moldMovement]);

            // Update mold status to '출고중'
            await updateMold(item.mold_id, { status: '출고중' });
        }

        return { data, error };
    };

    const processMoldIncoming = async (movementId, incomingData) => {
        const { error } = await supabase.from('mold_movement').update({
            incoming_date: incomingData.incoming_date,
            actual_cost: incomingData.actual_cost,
            repair_result: incomingData.repair_result,
            incoming_notes: incomingData.incoming_notes,
            status: '입고완료'
        }).eq('id', movementId);

        if (!error) {
            const movement = moldMovement.find(m => m.id === movementId);
            if (movement) {
                // Update local state
                setMoldMovement(moldMovement.map(m =>
                    m.id === movementId
                        ? { ...m, ...incomingData, status: '입고완료' }
                        : m
                ));

                // Update mold status based on repair result
                await updateMold(movement.mold_id, {
                    status: incomingData.return_status || '사용가능',
                    last_check: incomingData.incoming_date
                });
            }
        }

        return { error };
    };

    const getMoldMovements = (moldId) => {
        return moldMovement.filter(m => m.mold_id === moldId);
    };

    const getOutgoingMolds = () => {
        return moldMovement.filter(m => m.status === '출고중');
    };

    // 11. Suppliers
    const addSupplier = async (item) => {
        const { data, error } = await supabase.from('suppliers').insert([item]).select();
        if (!error && data) setSuppliers([...suppliers, data[0]]);
        return { data, error };
    };

    const updateSupplier = async (id, fields) => {
        const { error } = await supabase.from('suppliers').update(fields).eq('id', id);
        if (!error) setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...fields } : s));
        return { error };
    };

    const deleteSupplier = async (id) => {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (!error) setSuppliers(suppliers.filter(s => s.id !== id));
        return { error };
    };

    // 12. Purchase Requests
    const addPurchaseRequest = async (item) => {
        const { data, error } = await supabase.from('purchase_requests').insert([item]).select();
        if (!error && data) setPurchaseRequests([data[0], ...purchaseRequests]);
        return { data, error };
    };

    const updatePurchaseRequest = async (id, fields) => {
        const { error } = await supabase.from('purchase_requests').update(fields).eq('id', id);
        if (!error) setPurchaseRequests(purchaseRequests.map(r => r.id === id ? { ...r, ...fields } : r));
        return { error };
    };

    const deletePurchaseRequest = async (id) => {
        const { error } = await supabase.from('purchase_requests').delete().eq('id', id);
        if (!error) setPurchaseRequests(purchaseRequests.filter(r => r.id !== id));
        return { error };
    };

    // --- Products Management ---
    const addProduct = async (item) => {
        // Generate product code by finding max existing code to avoid collisions
        let nextNum = 1;
        if (products.length > 0) {
            const nums = products.map(p => {
                const match = (p.product_code || '').match(/PRD-(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            });
            nextNum = Math.max(...nums, 0) + 1;
        }
        const productCode = `PRD-${String(nextNum).padStart(4, '0')}`;

        const { data, error } = await supabase.from('products').insert([{
            product_code: productCode,
            name: item.name,
            model: item.model || '',
            unit: item.unit || 'EA',
            unit_price: item.unit_price || 0,
            product_type: item.product_type || '매출',
            company_name: item.company_name || '',
            standard_cycle_time: item.standard_cycle_time || 30,
            product_weight: item.product_weight || 0,
            runner_weight: item.runner_weight || 0,
            cavity_count: item.cavity_count || 1,
            material_id: item.material_id || null,
            min_stock: item.min_stock || 0,
            status: item.status || '생산중'
        }]).select();

        if (error) {
            console.error('Error adding product:', error);
            alert('제품 등록에 실패했습니다: ' + error.message);
            return;
        }
        if (data) setProducts([...products, ...data]);
    };

    const updateProduct = async (id, updates) => {
        const { data, error } = await supabase.from('products').update(updates).eq('id', id).select();
        if (error) console.error('Error updating product:', error);
        if (data) setProducts(products.map(p => p.id === id ? data[0] : p));
    };

    const deleteProduct = async (id) => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            console.error('Error deleting product:', error);
            // 외래키 위반(23503)이면 어느 데이터가 막는지 안내
            if (error.code === '23503') {
                alert(
                    '이 제품은 다른 데이터(작업지시·생산실적·재고·검사 등)에서 사용 중이라 삭제할 수 없습니다.\n' +
                    '먼저 연결된 데이터를 정리하거나, 삭제 대신 상태를 "단종"으로 변경하세요.\n\n' +
                    `상세: ${error.details || error.message}`
                );
            } else {
                alert(`제품 삭제에 실패했습니다.\n\n사유: ${error.message}${error.details ? '\n상세: ' + error.details : ''}${error.hint ? '\n힌트: ' + error.hint : ''}`);
            }
            return;
        }
        setProducts(products.filter(p => p.id !== id));
    };

    // --- Work Orders Management ---
    const addWorkOrder = async (order) => {
        const count = workOrders.length + 1;
        const orderCode = `WO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(count).padStart(3, '0')}`;

        const { data, error } = await supabase.from('work_orders').insert([{
            order_code: orderCode,
            product_id: order.product_id,
            equipment_id: order.equipment_id,
            target_quantity: order.target_quantity,
            produced_quantity: 0,
            order_date: order.order_date || new Date().toISOString().split('T')[0],
            status: '대기',
            notes: order.notes || ''
        }]).select();

        if (error) {
            console.error('Error adding work order:', error);
            alert('작업지시 등록에 실패했습니다.');
            return;
        }
        if (data) setWorkOrders([...workOrders, ...data]);
    };

    const updateWorkOrder = async (id, updates) => {
        const { data, error } = await supabase.from('work_orders').update(updates).eq('id', id).select();
        if (error) console.error('Error updating work order:', error);
        if (data) setWorkOrders(workOrders.map(wo => wo.id === id ? data[0] : wo));
    };

    const startWork = async (orderId) => {
        const order = workOrders.find(o => o.id === orderId);
        if (!order) return;

        // Update work order status and start time
        await updateWorkOrder(orderId, {
            status: '진행중',
            start_time: new Date().toISOString()
        });

        // Update equipment status and link to work order
        if (order.equipment_id) {
            await updateEquipment(order.equipment_id, {
                status: '가동중',
                current_work_order_id: orderId,
                temperature: 220,
                cycle_time: 38
            });
        }
    };

    const completeWork = async (orderId) => {
        const order = workOrders.find(o => o.id === orderId);
        if (!order) return;

        // Update work order status and end time
        await updateWorkOrder(orderId, {
            status: '완료',
            end_time: new Date().toISOString()
        });

        // Update equipment status
        if (order.equipment_id) {
            await updateEquipment(order.equipment_id, {
                status: '대기',
                current_work_order_id: null,
                temperature: 0,
                cycle_time: 0
            });
        }
    };

    const getActiveWorkOrders = () => {
        return workOrders.filter(wo => wo.status === '진행중' || wo.status === '대기');
    };

    // --- Sales Records ---
    const addSalesRecord = async (record) => {
        try {
            const { data, error } = await supabase.from('sales_records').insert([record]).select();
            if (error) throw error;
            if (data) setSalesRecords([...salesRecords, ...data]);
        } catch (e) {
            console.error('Error adding sales record:', e);
            // Silently fail if table doesn't exist yet
        }
    };

    // --- Image Upload ---
    const uploadImage = async (file) => {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('pms-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('pms-images').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('사진 업로드에 실패했습니다. (저장소 설정을 확인하세요)');
            return null;
        }
    };

    // --- Notification Functions ---
    const addNotification = async (userId, title, message, type, relatedId = null) => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .insert([{ user_id: userId, title, message, type, related_id: relatedId }])
                .select();

            if (error) throw error;
            if (data) setNotifications(prev => [data[0], ...prev]);
            return data?.[0];
        } catch (error) {
            console.error('Error adding notification:', error);
            return null;
        }
    };

    const markNotificationAsRead = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;
            setNotifications(prev => prev.map(n =>
                n.id === notificationId ? { ...n, is_read: true } : n
            ));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllNotificationsAsRead = async (userId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n =>
                n.user_id === userId ? { ...n, is_read: true } : n
            ));
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    // ============================================================
    // 자동 알림 체커 (Auto Notification Checks)
    // ------------------------------------------------------------
    // 데이터 로드 완료 후 자동으로 호출되어 다음 조건을 검사하고
    // 알림이 없으면 notifications 테이블에 생성한다.
    //   1) 원재료 안전재고 미달  (materials.stock < min_stock)
    //   2) 작업지시 지연          (status='진행중' + 시작 후 7일↑ + 진척률<100%)
    //   3) 금형 점검 도래          (last_check + 90일↑)
    // 같은 키([AUTO] title prefix + related_id)가 오늘 이미 있으면 스킵 →
    // 페이지 새로고침 시마다 중복 생성되지 않음.
    // ============================================================
    const NOTIF_LOW_STOCK_THRESHOLD_RATIO = 1.0;  // min_stock 미만이면 알림
    const NOTIF_WORK_DELAY_DAYS = 7;              // 진행중 N일 경과 시 지연 알림
    const NOTIF_MOLD_INSPECTION_DAYS = 90;        // 점검 후 N일 경과 시 점검 도래 알림

    const runNotificationChecks = async (userId) => {
        if (!userId) return;
        const today = new Date().toISOString().split('T')[0];
        const now = Date.now();

        // 오늘 생성된 자동 알림 키 셋 (중복 방지)
        const existingKeys = new Set(
            notifications
                .filter(n =>
                    n.user_id === userId &&
                    n.created_at && n.created_at.startsWith(today) &&
                    n.title && n.title.startsWith('[AUTO]')
                )
                .map(n => `${n.type}:${n.related_id}`)
        );

        const toCreate = [];

        // 1) 원재료 안전재고 미달
        (materials || []).forEach(m => {
            const minStock = parseFloat(m.min_stock || 0);
            const currentStock = parseFloat(m.stock || 0);
            if (minStock > 0 && currentStock < minStock * NOTIF_LOW_STOCK_THRESHOLD_RATIO) {
                const key = `production:${m.id}`;
                if (!existingKeys.has(key)) {
                    const pct = minStock > 0 ? Math.round((currentStock / minStock) * 100) : 0;
                    toCreate.push({
                        title: `[AUTO] 원재료 안전재고 미달: ${m.name}`,
                        message: `현재 재고 ${currentStock.toLocaleString()}${m.unit || ''} / 안전재고 ${minStock.toLocaleString()}${m.unit || ''} (${pct}%)`,
                        type: 'production',
                        relatedId: m.id
                    });
                }
            }
        });

        // 2) 작업지시 지연
        (workOrders || []).forEach(wo => {
            if (wo.status !== '진행중' || !wo.start_time) return;
            const startMs = new Date(wo.start_time).getTime();
            const daysSinceStart = Math.floor((now - startMs) / (1000 * 60 * 60 * 24));
            if (daysSinceStart < NOTIF_WORK_DELAY_DAYS) return;
            const target = parseFloat(wo.target_quantity || 0);
            const produced = parseFloat(wo.produced_quantity || 0);
            const progress = target > 0 ? (produced / target) * 100 : 0;
            if (progress >= 100) return;
            const key = `production:${wo.id}`;
            if (!existingKeys.has(key)) {
                toCreate.push({
                    title: `[AUTO] 작업지시 지연: ${wo.order_code || wo.id.slice(0, 8)}`,
                    message: `시작 후 ${daysSinceStart}일 경과, 진척률 ${progress.toFixed(1)}% (${produced.toLocaleString()}/${target.toLocaleString()})`,
                    type: 'production',
                    relatedId: wo.id
                });
            }
        });

        // 3) 금형 점검 도래
        (molds || []).forEach(mold => {
            if (!mold.last_check) return;
            if (mold.status === '폐기' || mold.status === '단종') return;
            const checkMs = new Date(mold.last_check).getTime();
            const daysSinceCheck = Math.floor((now - checkMs) / (1000 * 60 * 60 * 24));
            if (daysSinceCheck < NOTIF_MOLD_INSPECTION_DAYS) return;
            const key = `equipment:${mold.id}`;
            if (!existingKeys.has(key)) {
                toCreate.push({
                    title: `[AUTO] 금형 점검 필요: ${mold.name || mold.code || mold.id.slice(0, 8)}`,
                    message: `최종 점검 후 ${daysSinceCheck}일 경과 / 현재 타수: ${(mold.cycle_count || 0).toLocaleString()}`,
                    type: 'equipment',
                    relatedId: mold.id
                });
            }
        });

        // 일괄 생성 (실패해도 다른 알림에는 영향 없음)
        for (const alert of toCreate) {
            await addNotification(userId, alert.title, alert.message, alert.type, alert.relatedId);
        }
    };

    // --- Injection Conditions Functions ---
    const addInjectionCondition = async (conditionData) => {
        try {
            const { data, error } = await supabase
                .from('injection_conditions')
                .insert([conditionData])
                .select();

            if (error) throw error;
            if (data) setInjectionConditions(prev => [data[0], ...prev]);
            return data?.[0];
        } catch (error) {
            console.error('Error adding injection condition:', error);
            const msg = error.message || '사출조건 등록에 실패했습니다.';
            alert(`등록 실패: ${msg}`);
            return { error };
        }
    };

    const updateInjectionCondition = async (id, updates) => {
        try {
            // Remove non-schema fields if any (id, product_name etc should not be in updates)
            const { id: _, created_at: __, product_name: ___, ...cleanUpdates } = updates;

            const { error } = await supabase
                .from('injection_conditions')
                .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            setInjectionConditions(prev => prev.map(c =>
                c.id === id ? { ...c, ...cleanUpdates, updated_at: new Date().toISOString() } : c
            ));
            return { success: true };
        } catch (error) {
            console.error('Error updating injection condition:', error);
            const msg = error.message || '사출조건 수정에 실패했습니다.';
            alert(`수정 실패: ${msg}`);
            return { error };
        }
    };

    const deleteInjectionCondition = async (id) => {
        try {
            const { error } = await supabase
                .from('injection_conditions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setInjectionConditions(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting injection condition:', error);
            alert('사출조건 삭제에 실패했습니다.');
        }
    };

    const getConditionByProduct = (productId) => {
        return injectionConditions.find(c => c.product_id === productId);
    };

    // --- Production Logs ---
    const addProductionLog = async (log) => {
        try {
            const { data, error } = await supabase
                .from('production_logs')
                .insert([log])
                .select();
            if (error) throw error;
            if (data) setProductionLogs(prev => [data[0], ...prev]);
            return data?.[0];
        } catch (error) {
            console.error('Error adding production log:', error);
            return null;
        }
    };

    const updateProductionLog = async (id, fields) => {
        try {
            const { error } = await supabase
                .from('production_logs')
                .update(fields)
                .eq('id', id);
            if (error) throw error;
            setProductionLogs(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l));
            return { success: true };
        } catch (error) {
            console.error('Error updating production log:', error);
            alert('생산기록 수정에 실패했습니다.');
            return { error };
        }
    };

    const deleteProductionLog = async (id) => {
        try {
            const { error } = await supabase
                .from('production_logs')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setProductionLogs(prev => prev.filter(l => l.id !== id));
            return { success: true };
        } catch (error) {
            console.error('Error deleting production log:', error);
            alert('생산기록 삭제에 실패했습니다.');
            return { error };
        }
    };

    // --- Board (게시판) ---
    const addBoardPost = async (post) => {
        try {
            const { data, error } = await supabase.from('board_posts').insert([post]).select();
            if (error) throw error;
            if (data) setBoardPosts(prev => [data[0], ...prev]);
            return data?.[0];
        } catch (error) { console.error('Error adding board post:', error); return null; }
    };
    const updateBoardPost = async (id, fields) => {
        const { error } = await supabase.from('board_posts').update(fields).eq('id', id);
        if (!error) setBoardPosts(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
    };
    const deleteBoardPost = async (id) => {
        // 댓글도 함께 삭제
        await supabase.from('board_comments').delete().eq('post_id', id);
        const { error } = await supabase.from('board_posts').delete().eq('id', id);
        if (!error) {
            setBoardPosts(prev => prev.filter(p => p.id !== id));
            setBoardComments(prev => prev.filter(c => c.post_id !== id));
        }
    };
    const addBoardComment = async (comment) => {
        try {
            const { data, error } = await supabase.from('board_comments').insert([comment]).select();
            if (error) throw error;
            if (data) setBoardComments(prev => [...prev, data[0]]);
            return data?.[0];
        } catch (error) { console.error('Error adding comment:', error); return null; }
    };
    const deleteBoardComment = async (id) => {
        const { error } = await supabase.from('board_comments').delete().eq('id', id);
        if (!error) setBoardComments(prev => prev.filter(c => c.id !== id));
    };

    // Attendance
    const addAttendance = async (item) => {
        const { data, error } = await supabase.from('attendance').insert([item]).select();
        if (!error && data) setAttendance(prev => [data[0], ...prev]);
        return { data, error };
    };
    const updateAttendance = async (id, fields) => {
        const { error } = await supabase.from('attendance').update(fields).eq('id', id);
        if (!error) setAttendance(prev => prev.map(a => a.id === id ? { ...a, ...fields } : a));
        return { error };
    };
    const deleteAttendance = async (id) => {
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (!error) setAttendance(prev => prev.filter(a => a.id !== id));
    };

    // --- Payroll Records CRUD ---
    const addPayrollRecord = async (item) => {
        const { data, error } = await supabase.from('payroll_records').insert([item]).select();
        if (!error && data) setPayrollRecords(prev => [data[0], ...prev]);
        return { data, error };
    };
    const updatePayrollRecord = async (id, fields) => {
        const { error } = await supabase.from('payroll_records').update(fields).eq('id', id);
        if (!error) setPayrollRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
        return { error };
    };
    const deletePayrollRecord = async (id) => {
        const { error } = await supabase.from('payroll_records').delete().eq('id', id);
        if (!error) setPayrollRecords(prev => prev.filter(r => r.id !== id));
        return { error };
    };

    // --- Vouchers (전표) CRUD ---
    const addVoucher = async (item) => {
        const { data, error } = await supabase.from('vouchers').insert([item]).select();
        if (!error && data) setVouchers(prev => [data[0], ...prev]);
        return { data, error };
    };
    const updateVoucher = async (id, fields) => {
        const { error } = await supabase.from('vouchers').update(fields).eq('id', id);
        if (!error) setVouchers(prev => prev.map(v => v.id === id ? { ...v, ...fields } : v));
        return { error };
    };
    const deleteVoucher = async (id) => {
        const { error } = await supabase.from('vouchers').delete().eq('id', id);
        if (!error) setVouchers(prev => prev.filter(v => v.id !== id));
        return { error };
    };

    return (
        <DataContext.Provider value={{
            loading,
            molds, addMold, updateMold, deleteMold,
            repairHistory, addMoldHistory, deleteMoldHistory,
            materials, addMaterial, updateMaterial, deleteMaterial,
            equipments, addEquipment, updateEquipment, deleteEquipment,
            eqHistory, addEqHistory, deleteEqHistory,
            inspections, addInspection, updateInspection, deleteInspection,
            employees, addEmployee, updateEmployee, deleteEmployee,
            materialUsage, addMaterialUsage, getMaterialUsageHistory,
            updateMaterialUsage, deleteMaterialUsage,
            inventoryTransactions, addInventoryTransaction, updateInventoryTransaction,
            deleteInventoryTransaction, getTransactionsByDateRange,
            getInventorySnapshot, getMaterialStockAtDate,
            moldMovement, addMoldOutgoing, processMoldIncoming, getMoldMovements, getOutgoingMolds,
            products, addProduct, updateProduct, deleteProduct,
            workOrders, addWorkOrder, updateWorkOrder, startWork, completeWork, getActiveWorkOrders,
            salesRecords, addSalesRecord,
            uploadImage,
            notifications, addNotification, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification,
            injectionConditions, addInjectionCondition, updateInjectionCondition, deleteInjectionCondition, getConditionByProduct,
            suppliers, addSupplier, updateSupplier, deleteSupplier,
            purchaseRequests, addPurchaseRequest, updatePurchaseRequest, deletePurchaseRequest,
            productionLogs, addProductionLog, updateProductionLog, deleteProductionLog,
            boardPosts, boardComments, addBoardPost, updateBoardPost, deleteBoardPost, addBoardComment, deleteBoardComment,
            attendance, addAttendance, updateAttendance, deleteAttendance,
            payrollRecords, addPayrollRecord, updatePayrollRecord, deletePayrollRecord,
            vouchers, addVoucher, updateVoucher, deleteVoucher,
            logAudit,
            runNotificationChecks
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
