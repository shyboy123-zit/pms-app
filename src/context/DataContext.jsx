import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
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
                const { data: trans } = await supabase.from('inventory_transactions').select('*').order('transaction_date', { ascending: false });
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

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

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
        const { error } = await supabase.from('molds').delete().eq('id', id);
        if (!error) setMolds(molds.filter(m => m.id !== id));
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

    // 7. Employees
    const addEmployee = async (item) => {
        const { data, error } = await supabase.from('employees').insert([item]).select();
        if (!error && data) setEmployees([...employees, data[0]]);
    };
    const updateEmployee = async (id, fields) => {
        const { error } = await supabase.from('employees').update(fields).eq('id', id);
        if (!error) setEmployees(employees.map(e => e.id === id ? { ...e, ...fields } : e));
    };
    const deleteEmployee = async (id) => {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (!error) setEmployees(employees.filter(e => e.id !== id));
    };

    // 8. Material Usage
    const addMaterialUsage = async (item) => {
        const { data, error } = await supabase.from('material_usage').insert([item]).select();
        if (!error && data) {
            setMaterialUsage([data[0], ...materialUsage]);

            // Update material stock automatically
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
    const addInventoryTransaction = async (item) => {
        const { data, error } = await supabase.from('inventory_transactions').insert([item]).select();
        if (!error && data) setInventoryTransactions([data[0], ...inventoryTransactions]);
        return { data, error };
    };

    const updateInventoryTransaction = async (id, fields) => {
        const { error } = await supabase.from('inventory_transactions').update(fields).eq('id', id);
        if (!error) setInventoryTransactions(inventoryTransactions.map(t => t.id === id ? { ...t, ...fields } : t));
    };

    const deleteInventoryTransaction = async (id) => {
        const { error } = await supabase.from('inventory_transactions').delete().eq('id', id);
        if (!error) setInventoryTransactions(inventoryTransactions.filter(t => t.id !== id));
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

        // Calculate stock by item
        const stockByItem = {};
        if (data) {
            data.reverse().forEach(trans => {
                if (!stockByItem[trans.item_code || trans.item_name]) {
                    stockByItem[trans.item_code || trans.item_name] = {
                        itemName: trans.item_name,
                        itemCode: trans.item_code,
                        stock: 0,
                        unit: trans.unit
                    };
                }

                if (trans.transaction_type === 'IN') {
                    stockByItem[trans.item_code || trans.item_name].stock += parseFloat(trans.quantity);
                } else {
                    stockByItem[trans.item_code || trans.item_name].stock -= parseFloat(trans.quantity);
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
        const count = products.length + 1;
        const productCode = `PRD-${String(count).padStart(4, '0')}`;

        const { data, error } = await supabase.from('products').insert([{
            product_code: productCode,
            name: item.name,
            model: item.model || '',
            unit: item.unit || 'EA',
            standard_cycle_time: item.standard_cycle_time || 30,
            product_weight: item.product_weight || 0,
            runner_weight: item.runner_weight || 0,
            cavity_count: item.cavity_count || 1,
            material_id: item.material_id || null,
            status: item.status || '생산중'
        }]).select();

        if (error) {
            console.error('Error adding product:', error);
            alert('제품 등록에 실패했습니다.');
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
            alert('제품 삭제에 실패했습니다.');
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

    return (
        <DataContext.Provider value={{
            loading,
            molds, addMold, updateMold, deleteMold,
            repairHistory, addMoldHistory, deleteMoldHistory,
            materials, addMaterial, updateMaterial, deleteMaterial,
            equipments, addEquipment, updateEquipment, deleteEquipment,
            eqHistory, addEqHistory, deleteEqHistory,
            inspections, addInspection, updateInspection,
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
            productionLogs, addProductionLog
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
