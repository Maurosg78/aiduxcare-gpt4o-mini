# 🧭 Roadmap Readaptado – AiDuxCare: MVP Clínico vs Producto Comercial

Este documento define dos caminos posibles y complementarios para AiDuxCare:
1. 🩺 Un MVP clínico funcional y usable en entorno controlado (caso Montserrat o Andreina).
2. 🚀 Un producto comercial ampliado, listo para pilotos en múltiples centros de salud.

---

## ✅ VISIÓN A CORTO PLAZO: MVP CLÍNICO FUNCIONAL (v2.10 → v2.12)

**Objetivo:** permitir el flujo completo de una visita clínica real en entorno controlado.

### 🗂 Alcance funcional:

| Funcionalidad                      | Estado actual     | Acción pendiente                     |
|-----------------------------------|-------------------|--------------------------------------|
| Registro de pacientes             | ✅ Completo        | Validar campos obligatorios          |
| Formulario clínico estructurado   | ✅ Disponible      | Refinar tipado y persistencia        |
| Sugerencias IA generadas          | ✅ Implementado    | Integrar al EMR con botón "aceptar"  |
| Trazabilidad en Langfuse          | ✅ Activa          | Unificar logs por visita             |
| Redacción de resumen clínico IA   | ❌ No disponible   | Generar resumen con contexto MCP     |
| Ficha clínica por paciente        | 🟡 Parcial         | Consolidar visitas + contexto        |

### 📆 Tiempo estimado: **10–14 días de trabajo efectivo**

---

## 🚀 VISIÓN A MEDIANO PLAZO: PRODUCTO PILOTO COMERCIAL

**Objetivo:** presentar AiDuxCare como plataforma inteligente adoptable por clínicas.

### 📦 Alcance ampliado:

| Componente                        | Tiempo estimado    | Consideraciones                        |
|----------------------------------|--------------------|----------------------------------------|
| Integración IA ↔ EMR completa    | 2–3 semanas        | Feedback visual, Langfuse, UI robusta |
| Generador de resúmenes IA        | 2–3 semanas        | Editor, validación clínica            |
| Navegación de ficha clínica      | 3–4 semanas        | Por paciente, múltiples visitas       |
| Formularios IA guiados           | 2–3 semanas        | Interacción tipo wizard               |
| Testing + QA clínico             | 2 semanas          | Accesibilidad, errores, consentimiento|

### ⏳ Total estimado: **13–18 semanas** (3–4.5 meses)

---

## 📌 Recomendación CTO

1. **Cierra el MVP clínico controlado primero.**
2. Valida un caso real documentado (Montserrat o Andreina).
3. Luego evalúa ampliación a roadmap de producto.
4. Mantén foco: evitar rediseños o nuevas funcionalidades sin validar las anteriores.

---

## 📂 Siguiente paso

Ubicar este roadmap en:
`/docs/ROADMAP_READAPTADO_MVP_vs_PRODUCTO.md`

