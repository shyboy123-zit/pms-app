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


    return (
        <DataContext.Provider value={{
            loading,
            molds, addMold, updateMold,
            repairHistory, addMoldHistory,
            materials, addMaterial, updateMaterial,
            equipments, addEquipment, updateEquipment,
            eqHistory, addEqHistory,
            inspections, addInspection, updateInspection,
            employees, addEmployee, updateEmployee
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => useContext(DataContext);
