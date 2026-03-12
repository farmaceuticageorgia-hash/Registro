import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Save, 
  ClipboardList, 
  User, 
  Stethoscope, 
  CheckCircle2,
  AlertCircle,
  Trash2,
  MessageSquare,
  Send
} from "lucide-react";
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
import { PatientRecord, Intervention } from "./types";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxXsr5uULq6Z9ivAlJe3Ecj_BKuhwqPI_5OzG0DrYwk93QpxlHfqRBsWStNRsoe6rJM/exec";

export default function App() {
  const [view, setView] = useState<"form" | "support">("form");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    // Initialization if needed
  }, []);

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

  const handleClassificationSelect = (index: number, classification: string) => {
    const newInterventions = [...formData.interventions];
    newInterventions[index].classifications = [classification];
    setFormData({ ...formData, interventions: newInterventions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
        
        // Coluna F: Clínica ou Processo
        let classificationValue = intervention.classifications[0] || "Não preenchido";
        if (intervention.type === "Não houve intervenção") {
          classificationValue = "Não houve intervenção";
        }

        if (intervention.type === "Intervenção clínica") {
          params.append("classificacao_clinica", classificationValue);
        } else if (intervention.type === "Intervenção de processo") {
          params.append("classificacao_processo", classificationValue);
        } else {
          params.append("classificacao", classificationValue);
        }
        
        // Coluna I: Classificação de custo (E.01, E.02...)
        if (intervention.is_economic === "Sim" && intervention.cost_classification) {
          params.append("classificacao_qualitativa_de_economia", intervention.cost_classification);
        } else {
          params.append("classificacao_qualitativa_de_economia", "");
        }

        params.append("aceitacao_medica", intervention.acceptance);
        params.append("potencial_economico", intervention.is_economic);
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
      } else {
        setError("Erro ao salvar registro no banco de dados.");
      }
    } catch (error) {
      console.error("Error saving record:", error);
      setError("Erro de conexão. Verifique sua internet.");
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
                <span className="font-medium">REGISTRO ENVIADO</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
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

                    {/* Classificações - Single Select Group */}
                    {intervention.type && intervention.type !== "Não houve intervenção" && (
                      <div className="space-y-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 animate-in fade-in zoom-in duration-300">
                        <label className="text-sm font-bold text-zinc-800 uppercase tracking-wider">
                          Classificação – {intervention.type === "Intervenção de processo" ? "Processo" : "Clínica"}
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(intervention.type === "Intervenção de processo" ? PROCESS_CLASSIFICATIONS : CLINICAL_CLASSIFICATIONS).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleClassificationSelect(index, c)}
                              className={cn(
                                "flex items-start text-left gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                                intervention.classifications.includes(c)
                                  ? "bg-white border-emerald-200 shadow-sm"
                                  : "border-transparent hover:bg-white/50"
                              )}
                            >
                              <div className={cn(
                                "mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                                intervention.classifications.includes(c) ? "border-emerald-600 bg-emerald-600" : "border-zinc-300"
                              )}>
                                {intervention.classifications.includes(c) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                              <span className={cn(
                                "text-sm leading-tight",
                                intervention.classifications.includes(c) ? "text-emerald-900 font-medium" : "text-zinc-600"
                              )}>{c}</span>
                            </button>
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

                        {/* Cost Classification - Conditional - MOVED HERE */}
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
