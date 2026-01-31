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
    const [inventoryTransactions, setInventoryTransactions] = useState([]);
    const [moldMovement, setMoldMovement] = useState([]);

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

            const { data: usage } = await supabase.from('material_usage').select('*').order('usage_date', { ascending: false });
            if (usage) setMaterialUsage(usage);

            const { data: trans } = await supabase.from('inventory_transactions').select('*').order('transaction_date', { ascending: false });
            if (trans) setInventoryTransactions(trans);

            const { data: movements } = await supabase.from('mold_movement').select('*').order('outgoing_date', { ascending: false });
            if (movements) setMoldMovement(movements);

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

    // 2. Mold History
    const addMoldHistory = async (item) => {
        const { data, error } = await supabase.from('mold_history').insert([item]).select();
        if (!error && data) setRepairHistory([data[0], ...repairHistory]);
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

    // 5. Equipment History
    const addEqHistory = async (item) => {
        const { data, error } = await supabase.from('equipment_history').insert([item]).select();
        if (!error && data) setEqHistory([data[0], ...eqHistory]);
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

    const deleteMaterialUsage = async (id, materialId, quantity) => {
        const { error } = await supabase.from('material_usage').delete().eq('id', id);
        if (!error) {
            setMaterialUsage(materialUsage.filter(u => u.id !== id));

            // Add back the quantity to material stock
            if (materialId) {
                const material = materials.find(m => m.id === materialId);
                if (material) {
                    const newStock = material.stock + quantity;
                    await updateMaterial(materialId, { stock: newStock });
                }
            }
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


    return (
        <DataContext.Provider value={{
            loading,
            molds, addMold, updateMold,
            repairHistory, addMoldHistory,
            materials, addMaterial, updateMaterial, deleteMaterial,
            equipments, addEquipment, updateEquipment,
            eqHistory, addEqHistory,
            inspections, addInspection, updateInspection,
            employees, addEmployee, updateEmployee, deleteEmployee,
            materialUsage, addMaterialUsage, getMaterialUsageHistory,
            updateMaterialUsage, deleteMaterialUsage,
            inventoryTransactions, addInventoryTransaction, updateInventoryTransaction,
            deleteInventoryTransaction, getTransactionsByDateRange,
            getInventorySnapshot, getMaterialStockAtDate,
            moldMovement, addMoldOutgoing, processMoldIncoming, getMoldMovements, getOutgoingMolds,
            uploadImage
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
