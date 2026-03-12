import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Save, 
  BarChart3, 
  ClipboardList, 
  User, 
  MapPin, 
  Stethoscope, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Trash2,
  MessageSquare,
  Send
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { cn } from "./utils";
import { 
  SECTORS, 
  SPECIALTIES, 
  INTERVENTION_TYPES, 
  PROCESS_CLASSIFICATIONS, 
  CLINICAL_CLASSIFICATIONS, 
  ACCEPTANCE_OPTIONS, 
  COST_CLASSIFICATIONS 
} from "./constants";
import { PatientRecord, Intervention, Stats } from "./types";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxXsr5uULq6Z9ivAlJe3Ecj_BKuhwqPI_5OzG0DrYwk93QpxlHfqRBsWStNRsoe6rJM/exec";

export default function App() {
  const [view, setView] = useState<"form" | "dashboard" | "support">("form");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [success, setSuccess] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PatientRecord>({
    date: new Date().toISOString().split('T')[0],
    pharmacist_name: "",
    sector: "",
    bed_number: "",
    interventions: [
      { type: "", specialty: "", classifications: [], acceptance: "", is_economic: "", cost_classification: "" }
    ]
  });

  useEffect(() => {
    if (view === "dashboard") {
      fetchStats();
    }
  }, [view]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleAddIntervention = () => {
    if (formData.interventions.length < 5) {
      setFormData({
        ...formData,
        interventions: [
          ...formData.interventions,
          { type: "", specialty: "", classifications: [], acceptance: "", is_economic: "", cost_classification: "" }
        ]
      });
    }
  };

  const handleRemoveIntervention = (index: number) => {
    const newInterventions = formData.interventions.filter((_, i) => i !== index);
    setFormData({ ...formData, interventions: newInterventions });
  };

  const handleInterventionChange = (index: number, field: keyof Intervention, value: any) => {
    const newInterventions = [...formData.interventions];
    newInterventions[index] = { ...newInterventions[index], [field]: value };
    
    // Reset classifications if type changes
    if (field === "type") {
      newInterventions[index].classifications = [];
      if (value === "Não houve intervenção") {
        newInterventions[index].specialty = "Não aplicável";
        newInterventions[index].acceptance = "Não aplicável";
        newInterventions[index].is_economic = "Não se aplica";
        newInterventions[index].cost_classification = "Não aplicável";
      }
    }

    if (field === "is_economic" && value !== "Sim") {
      newInterventions[index].cost_classification = "Não aplicável";
    }
    
    setFormData({ ...formData, interventions: newInterventions });
  };

  const toggleClassification = (index: number, classification: string) => {
    const newInterventions = [...formData.interventions];
    const current = newInterventions[index].classifications;
    if (current.includes(classification)) {
      newInterventions[index].classifications = current.filter(c => c !== classification);
    } else {
      newInterventions[index].classifications = [...current, classification];
    }
    setFormData({ ...formData, interventions: newInterventions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Save to local SQLite database
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      // 2. Send to Google Sheets (Integration)
      // Envia uma requisição para cada intervenção para que cada uma seja uma linha na planilha
      formData.interventions.forEach(intervention => {
        const params = new URLSearchParams();
        params.append("farmaceutico", formData.pharmacist_name);
        params.append("setor", formData.sector);
        params.append("leito", formData.bed_number);
        params.append("tipo_intervencao", intervention.type);
        
        // Se houver classificações de processo/clínica, envia em 'classificacao'
        // Se for econômica, envia a classificação de custo em 'classificacao_economia'
        const mainClassifications = intervention.classifications.join(", ");
        if (mainClassifications) {
          params.append("classificacao", mainClassifications);
        }
        if (intervention.is_economic === "Sim" && intervention.cost_classification) {
          params.append("classificacao_economia", intervention.cost_classification);
        }
        // Se ambos estiverem vazios, o script vai acabar pegando vazio ou podemos mandar um padrão
        if (!mainClassifications && !(intervention.is_economic === "Sim" && intervention.cost_classification)) {
          params.append("classificacao", "Nenhuma");
        }

        params.append("aceitacao_medica", intervention.acceptance);
        params.append("economica", intervention.is_economic);
        params.append("especialidade", intervention.specialty);

        fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: params.toString(),
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }).catch(err => console.error("Erro ao enviar para Google Sheets:", err));
      });

      if (res.ok) {
        setSuccess(true);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          pharmacist_name: "",
          sector: "",
          bed_number: "",
          interventions: [{ type: "", specialty: "", classifications: [], acceptance: "", is_economic: "", cost_classification: "" }]
        });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error saving record:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSupportError(null);
    
    const form = e.currentTarget;
    const formDataObj = new FormData(form);
    const params = new URLSearchParams();
    formDataObj.forEach((value, key) => {
      params.append(key, value.toString());
    });
    
    try {
      // Using fetch with no-cors for Google Apps Script to avoid CORS issues
      // while still sending the data.
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: params.toString(),
        mode: "no-cors",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      
      setSupportSuccess(true);
      form.reset();
      setTimeout(() => setSupportSuccess(false), 5000);
    } catch (error) {
      setSupportError("Erro ao enviar mensagem. Por favor, tente novamente.");
      console.error("Support submission error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <ClipboardList className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg hidden sm:block">Farmácia Clínica</h1>
          </div>
          
          <nav className="flex gap-1 bg-zinc-100 p-1 rounded-xl">
            <button
              onClick={() => setView("form")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === "form" ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <Plus className="w-4 h-4" />
              Novo Registro
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === "dashboard" ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setView("support")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === "support" ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Suporte
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {view === "form" ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-zinc-900">Registro de Intervenção</h2>
              <p className="text-zinc-500">Preencha os dados do paciente e as intervenções realizadas.</p>
            </div>

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Registro salvo com sucesso!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8 pb-20">
              {/* Section 1: Identification */}
              <section className="card p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-4">
                  <User className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-zinc-900">SEÇÃO 1 — Identificação / Registro</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Data</label>
                    <input
                      required
                      type="date"
                      className="input-field"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Nome do Farmacêutico</label>
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder="Ex: João Silva"
                      value={formData.pharmacist_name}
                      onChange={(e) => setFormData({ ...formData, pharmacist_name: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Setor</label>
                    <select
                      required
                      className="input-field"
                      value={formData.sector}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    >
                      <option value="">Selecione o setor</option>
                      {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Número do Leito</label>
                    <input
                      required
                      type="text"
                      className="input-field"
                      placeholder="Ex: 102-A"
                      value={formData.bed_number}
                      onChange={(e) => setFormData({ ...formData, bed_number: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Interventions */}
              {formData.interventions.map((intervention, index) => (
                <section key={index} className="card p-6 space-y-6 relative animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-semibold text-zinc-900 uppercase">INTERVENÇÃO {index + 1}</h3>
                    </div>
                    {formData.interventions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveIntervention(index)}
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    {/* Tipo de Intervenção - Radio Group */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Tipo de Intervenção</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {INTERVENTION_TYPES.map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleInterventionChange(index, "type", type)}
                            className={cn(
                              "px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left flex items-center justify-between",
                              intervention.type === type 
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                                : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-200"
                            )}
                          >
                            {type}
                            {intervention.type === type && <CheckCircle2 className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Classificações - Checkbox Group */}
                    {intervention.type && intervention.type !== "Não houve intervenção" && (
                      <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 animate-in fade-in zoom-in duration-300">
                        <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                          Classificação – {intervention.type === "Intervenção de processo" ? "Processo" : "Clínica"}
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(intervention.type === "Intervenção de processo" ? PROCESS_CLASSIFICATIONS : CLINICAL_CLASSIFICATIONS).map(c => (
                            <label
                              key={c}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                                intervention.classifications.includes(c)
                                  ? "bg-white border-emerald-200 shadow-sm"
                                  : "border-transparent hover:bg-white/50"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                                checked={intervention.classifications.includes(c)}
                                onChange={() => toggleClassification(index, c)}
                              />
                              <span className={cn(
                                "text-sm leading-tight",
                                intervention.classifications.includes(c) ? "text-emerald-900 font-medium" : "text-zinc-600"
                              )}>{c}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {intervention.type !== "Não houve intervenção" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Aceitação Médica - Radio Group */}
                        <div className="space-y-3">
                          <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Aceitação Médica</label>
                          <div className="flex flex-col gap-2">
                            {ACCEPTANCE_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleInterventionChange(index, "acceptance", opt)}
                                className={cn(
                                  "px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left flex items-center justify-between",
                                  intervention.acceptance === opt 
                                    ? "border-blue-500 bg-blue-50 text-blue-700" 
                                    : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-200"
                                )}
                              >
                                {opt}
                                {intervention.acceptance === opt && <CheckCircle2 className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Potencialmente Econômica - Radio Group */}
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">A intervenção é potencialmente econômica?</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {["Sim", "Não", "Não se aplica"].map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleInterventionChange(index, "is_economic", opt)}
                                className={cn(
                                  "px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left flex items-center justify-between",
                                  intervention.is_economic === opt 
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                                    : "border-zinc-100 bg-zinc-50 text-zinc-600 hover:border-zinc-200"
                                )}
                              >
                                {opt}
                                {intervention.is_economic === opt && <CheckCircle2 className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Especialidade Médica - Per Intervention */}
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Especialidade Médica Responsável</label>
                          <select
                            required
                            className="input-field"
                            value={intervention.specialty}
                            onChange={(e) => handleInterventionChange(index, "specialty", e.target.value)}
                          >
                            <option value="">Selecione a especialidade</option>
                            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>

                        {/* Cost Classification - Conditional */}
                        {intervention.is_economic === "Sim" && (
                          <div className="space-y-3 md:col-span-2 animate-in fade-in zoom-in duration-300">
                            <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Classificação Qualitativa de Economia</label>
                            <select
                              required
                              className="input-field bg-zinc-50"
                              value={intervention.cost_classification}
                              onChange={(e) => handleInterventionChange(index, "cost_classification", e.target.value)}
                            >
                              <option value="">Selecione a classificação de custo</option>
                              {COST_CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              ))}

              {formData.interventions.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddIntervention}
                  className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-500 font-medium hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Outra Intervenção
                </button>
              )}

              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 z-20">
                <div className="max-w-5xl mx-auto flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({
                      date: new Date().toISOString().split('T')[0],
                      pharmacist_name: "",
                      sector: "",
                      bed_number: "",
                      interventions: [{ type: "", specialty: "", classifications: [], acceptance: "", is_economic: "", cost_classification: "" }]
                    })}
                    className="btn-secondary"
                  >
                    Limpar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Salvar Registro
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : view === "dashboard" ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-zinc-900">Análise de Resultados</h2>
              <p className="text-zinc-500">Visão geral das intervenções e impacto clínico.</p>
            </div>

            {stats ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card p-6 flex flex-col gap-2">
                    <span className="text-zinc-500 text-sm font-medium">Total de Pacientes</span>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold">{stats.totalRecords}</span>
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <User className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                  <div className="card p-6 flex flex-col gap-2">
                    <span className="text-zinc-500 text-sm font-medium">Total Intervenções</span>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold">{stats.totalInterventions}</span>
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Activity className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </div>
                  <div className="card p-6 flex flex-col gap-2">
                    <span className="text-zinc-500 text-sm font-medium">Taxa de Aceitação</span>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold">
                        {stats.totalInterventions > 0 
                          ? Math.round((stats.byAcceptance.find(a => a.acceptance === "Aceita")?.count || 0) / stats.totalInterventions * 100)
                          : 0}%
                      </span>
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-amber-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card p-6 space-y-4">
                    <h3 className="font-semibold text-zinc-900">Intervenções por Tipo</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.byType}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="count"
                            nameKey="type"
                          >
                            {stats.byType.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-4 justify-center">
                      {stats.byType.map((entry, index) => (
                        <div key={entry.type} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-xs text-zinc-600">{entry.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card p-6 space-y-4">
                    <h3 className="font-semibold text-zinc-900">Intervenções por Setor</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.bySector}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                          <XAxis dataKey="sector" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card p-6 space-y-4 lg:col-span-2">
                    <h3 className="font-semibold text-zinc-900">Aceitação Médica</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={stats.byAcceptance}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                          <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis dataKey="acceptance" type="category" fontSize={12} tickLine={false} axisLine={false} width={120} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-zinc-500 font-medium">Carregando estatísticas...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-zinc-900">Suporte e Feedback</h2>
              <p className="text-zinc-500">Envie suas dúvidas ou sugestões diretamente para nossa equipe.</p>
            </div>

            <div className="card p-8 max-w-2xl mx-auto">
              {supportSuccess && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Mensagem enviada com sucesso!</span>
                </div>
              )}

              {supportError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">{supportError}</span>
                </div>
              )}

              <form 
                action={GOOGLE_SCRIPT_URL} 
                onSubmit={handleSupportSubmit}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Seu Nome</label>
                  <input 
                    type="text" 
                    name="nome" 
                    placeholder="Como podemos te chamar?" 
                    required 
                    className="input-field"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Seu Email</label>
                  <input 
                    type="email" 
                    name="email" 
                    placeholder="seu@email.com" 
                    required 
                    className="input-field"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Sua Mensagem</label>
                  <textarea 
                    name="mensagem" 
                    placeholder="Descreva sua dúvida, sugestão ou problema..." 
                    rows={5}
                    className="input-field resize-none"
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  Enviar Dados
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
