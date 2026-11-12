/* =========================================================================
   ACAEMAT Táchira — Modelos de examen listos para usar
   El docente los carga desde el editor de evaluaciones («Cargar modelo»)
   y luego los edita libremente. Formato de cada pregunta:
   { q: "enunciado", o: ["opción A", "opción B", ...], a: índice de la correcta }
   ========================================================================= */
(function () {
  "use strict";
  var VF = ["Verdadero", "Falso"];

  window.ACAEMAT_EXAMS = [
    {
      id: "seleccion-simple",
      name: "Selección simple",
      title: "Evaluación: signos vitales en el adulto",
      area: "Enfermería",
      use: "Comprobar conceptos clave al cerrar una lección o un módulo.",
      questions: [
        { q: "¿Cuál es el rango normal de frecuencia cardíaca en un adulto en reposo?", o: ["40 a 59 lpm", "60 a 100 lpm", "101 a 140 lpm"], a: 1 },
        { q: "La frecuencia respiratoria normal de un adulto en reposo es de:", o: ["12 a 20 respiraciones por minuto", "6 a 10 respiraciones por minuto", "24 a 30 respiraciones por minuto"], a: 0 },
        { q: "Una temperatura axilar considerada normal en el adulto es:", o: ["34,0 a 35,0 °C", "38,0 a 39,0 °C", "36,0 a 37,2 °C"], a: 2 },
        { q: "¿Qué valor de presión arterial se considera normal en un adulto?", o: ["Entre 140/90 y 160/100 mmHg", "Menos de 120/80 mmHg", "Más de 180/110 mmHg"], a: 1 },
        { q: "¿En qué arteria se toma con mayor frecuencia el pulso en la consulta de un adulto?", o: ["Radial", "Femoral", "Pedia"], a: 0 },
        { q: "En un adulto sano respirando aire ambiente, la saturación de oxígeno (SpO₂) esperada es:", o: ["70 a 80 %", "85 a 90 %", "95 a 100 %"], a: 2 }
      ]
    },
    {
      id: "verdadero-falso",
      name: "Verdadero o falso",
      title: "Evaluación: normas de bioseguridad",
      area: "Bioseguridad",
      use: "Repasos rápidos y normas que no admiten término medio.",
      questions: [
        { q: "Las agujas usadas deben reencapucharse antes de desecharlas.", o: VF, a: 1 },
        { q: "La fricción de manos con solución alcohólica debe durar entre 20 y 30 segundos.", o: VF, a: 0 },
        { q: "El contenedor de punzocortantes se reemplaza cuando alcanza las tres cuartas partes de su capacidad.", o: VF, a: 0 },
        { q: "El uso de guantes sustituye la higiene de manos.", o: VF, a: 1 },
        { q: "Ante un pinchazo accidental se debe exprimir la herida para que sangre.", o: VF, a: 1 },
        { q: "La higiene de manos se realiza antes y después de tocar al paciente.", o: VF, a: 0 }
      ]
    },
    {
      id: "caso-clinico",
      name: "Caso clínico",
      title: "Evaluación: casos de atención prehospitalaria",
      area: "Emergencias",
      use: "Medir la toma de decisiones con situaciones reales, no solo la memoria.",
      questions: [
        { q: "CASO 1. Un hombre de 55 años se desploma en la calle. La escena es segura; no responde y no respira con normalidad. Usted está solo y tiene un teléfono. ¿Qué hace primero?", o: ["Darle dos ventilaciones de rescate", "Llamar al 911 en altavoz e iniciar compresiones torácicas", "Buscar el pulso durante un minuto completo"], a: 1 },
        { q: "CASO 1 (continuación). Alguien llega con un desfibrilador externo automático (DEA). ¿Qué corresponde?", o: ["Encenderlo de inmediato y seguir sus indicaciones de voz", "Terminar cinco ciclos completos antes de usarlo", "Esperar a la ambulancia para que lo use el personal"], a: 0 },
        { q: "CASO 1 (continuación). ¿Qué profundidad deben tener sus compresiones en este adulto?", o: ["2 a 3 cm", "8 a 10 cm", "5 a 6 cm"], a: 2 },
        { q: "CASO 2. Una mujer presenta una hemorragia abundante en el antebrazo tras un corte con vidrio. ¿Cuál es la primera medida?", o: ["Aplicar presión directa y firme sobre la herida", "Lavar la herida con abundante agua antes de cubrirla", "Elevar el brazo y esperar a que deje de sangrar"], a: 0 },
        { q: "CASO 3. Un motociclista consciente refiere dolor en el cuello después de una caída. ¿Qué debe hacer?", o: ["Pedirle que mueva el cuello para valorar el dolor", "Sentarlo de inmediato para que respire mejor", "Mantener la cabeza y el cuello alineados y evitar movimientos innecesarios"], a: 2 }
      ]
    },
    {
      id: "calculo-dosis",
      name: "Cálculo de dosis y goteo",
      title: "Evaluación: cálculo de dosis y velocidad de infusión",
      area: "Enfermería",
      use: "Ejercicios numéricos con una sola respuesta correcta.",
      questions: [
        { q: "Se indican 500 mg de un jarabe cuya presentación es 250 mg/5 mL. ¿Cuántos mL administra?", o: ["5 mL", "10 mL", "2,5 mL"], a: 1 },
        { q: "Una ampolla contiene 1 g en 10 mL. La indicación es de 300 mg. ¿Cuántos mL debe cargar?", o: ["3 mL", "0,3 mL", "30 mL"], a: 0 },
        { q: "Deben pasar 1000 mL de solución en 8 horas con un macrogotero (20 gotas/mL). ¿Cuántas gotas por minuto?", o: ["21 gotas/min", "63 gotas/min", "42 gotas/min"], a: 2 },
        { q: "Deben pasar 500 mL en 10 horas con un microgotero (60 microgotas/mL). ¿Cuántas microgotas por minuto?", o: ["50 microgotas/min", "25 microgotas/min", "83 microgotas/min"], a: 0 },
        { q: "Se indica un medicamento a 15 mg/kg a un niño de 20 kg. ¿Cuál es la dosis total?", o: ["150 mg", "300 mg", "600 mg"], a: 1 }
      ]
    },
    {
      id: "secuencia",
      name: "Secuencia de procedimiento",
      title: "Evaluación: pasos de la venopunción",
      area: "Laboratorio",
      use: "Verificar que el estudiante domina el orden correcto de una técnica.",
      questions: [
        { q: "¿Cuál es el primer paso antes de cualquier extracción de sangre?", o: ["Colocar el torniquete", "Identificar al paciente con dos identificadores", "Preparar los tubos de muestra"], a: 1 },
        { q: "Tras colocar el torniquete y seleccionar la vena, el paso siguiente es:", o: ["Realizar la antisepsia de la zona y dejarla secar", "Puncionar de inmediato", "Retirar el torniquete"], a: 0 },
        { q: "En el orden de extracción, ¿qué tubo se llena antes?", o: ["Lila (EDTA)", "Gris (fluoruro)", "Celeste (citrato)"], a: 2 },
        { q: "Al terminar la extracción, ¿qué se retira primero?", o: ["La aguja", "El torniquete", "El algodón"], a: 1 },
        { q: "¿Qué se hace con la aguja después de usarla?", o: ["Desecharla de inmediato en el contenedor rígido, sin reencapuchar", "Reencapucharla con las dos manos", "Dejarla en la bandeja para desecharla al final"], a: 0 }
      ]
    },
    {
      id: "interpretacion",
      name: "Interpretación técnica",
      title: "Evaluación: electrocardiografía básica",
      area: "Diagnóstico",
      use: "Reconocer valores, posiciones y hallazgos en un estudio o equipo.",
      questions: [
        { q: "¿Cuántas derivaciones tiene un electrocardiograma estándar?", o: ["6", "12", "15"], a: 1 },
        { q: "¿Dónde se coloca el electrodo V1?", o: ["4.º espacio intercostal, borde esternal derecho", "5.º espacio intercostal, línea medioclavicular izquierda", "2.º espacio intercostal, borde esternal izquierdo"], a: 0 },
        { q: "¿Dónde se coloca el electrodo V4?", o: ["4.º espacio intercostal, borde esternal izquierdo", "Línea axilar media izquierda", "5.º espacio intercostal, línea medioclavicular izquierda"], a: 2 },
        { q: "¿Qué onda representa la despolarización de las aurículas?", o: ["Onda T", "Onda P", "Complejo QRS"], a: 1 },
        { q: "¿Cuál es la velocidad estándar del papel en un ECG?", o: ["25 mm/s", "10 mm/s", "50 mm/min"], a: 0 }
      ]
    },
    {
      id: "diagnostica",
      name: "Prueba diagnóstica",
      title: "Prueba de entrada: terminología médica",
      area: "Medicina",
      use: "Al inicio del curso, para conocer el nivel del grupo.",
      questions: [
        { q: "«Taquicardia» significa:", o: ["Frecuencia cardíaca baja", "Ritmo cardíaco irregular", "Frecuencia cardíaca elevada"], a: 2 },
        { q: "«Hipotermia» significa:", o: ["Temperatura corporal baja", "Temperatura corporal alta", "Presión arterial baja"], a: 0 },
        { q: "El sufijo «-itis» indica:", o: ["Dolor", "Inflamación", "Extirpación"], a: 1 },
        { q: "«Disnea» significa:", o: ["Dificultad para tragar", "Dificultad para respirar", "Dificultad para hablar"], a: 1 },
        { q: "«Cefalea» significa:", o: ["Dolor de cabeza", "Dolor de pecho", "Mareo"], a: 0 },
        { q: "El prefijo «hemi-» significa:", o: ["Sangre", "Doble", "Mitad"], a: 2 }
      ]
    },
    {
      id: "excepcion",
      name: "¿Cuál NO corresponde?",
      title: "Evaluación: bioseguridad (preguntas de excepción)",
      area: "Bioseguridad",
      use: "Tres opciones correctas y una intrusa: obliga a dominar el tema completo.",
      questions: [
        { q: "¿Cuál NO es uno de los cinco momentos de la higiene de manos de la OMS?", o: ["Antes de tocar al paciente", "Después del riesgo de exposición a fluidos corporales", "Después de tocar al paciente", "Al llegar al estacionamiento del centro de salud"], a: 3 },
        { q: "¿Cuál NO es un equipo de protección personal?", o: ["Guantes", "Mascarilla", "Bata", "Reloj de pulsera"], a: 3 },
        { q: "¿Dónde NO debe desecharse una aguja usada?", o: ["Contenedor rígido de punzocortantes", "Bolsa de desechos comunes", "Contenedor rígido ubicado en el punto de uso"], a: 1 },
        { q: "¿Cuál NO es una acción correcta tras un pinchazo accidental?", o: ["Lavar con agua y jabón", "Notificar al supervisor", "Exprimir y frotar con fuerza la herida", "Acudir a salud ocupacional"], a: 2 }
      ]
    },
    {
      id: "final-integrador",
      name: "Examen final integrador",
      title: "Examen final",
      area: "Todas",
      use: "Última lección del curso: al aprobarlo el estudiante completa el programa y obtiene su certificado.",
      questions: [
        { q: "¿Cuál es el rango normal de frecuencia cardíaca en un adulto en reposo?", o: ["40 a 50 lpm", "60 a 100 lpm", "110 a 140 lpm", "150 a 180 lpm"], a: 1 },
        { q: "En la valoración ABCDE, ¿qué se evalúa con la letra A?", o: ["Alergias", "Vía aérea", "Abdomen", "Alimentación"], a: 1 },
        { q: "¿Qué profundidad deben tener las compresiones torácicas en un adulto?", o: ["2 a 3 cm", "5 a 6 cm", "8 a 10 cm"], a: 1 },
        { q: "¿Cuál es la vena de primera elección para la venopunción?", o: ["Cefálica", "Cubital media", "Basílica", "Yugular"], a: 1 },
        { q: "¿Qué tubo se usa habitualmente para medir glucosa?", o: ["Lila (EDTA)", "Celeste (citrato)", "Gris (fluoruro)", "Verde (heparina)"], a: 2 },
        { q: "¿Dónde se coloca el electrodo V1 en un ECG de 12 derivaciones?", o: ["4.º espacio intercostal, borde esternal derecho", "4.º espacio intercostal, borde esternal izquierdo", "5.º espacio intercostal, línea medioclavicular izquierda"], a: 0 },
        { q: "¿Cada cuánto se recomienda cambiar de posición a un paciente encamado para prevenir úlceras por presión?", o: ["Cada 30 minutos", "Cada 2 horas", "Cada 8 horas", "Una vez al día"], a: 1 },
        { q: "¿A qué temperatura se conservan las vacunas en la cadena de frío?", o: ["Entre −20 y −10 °C", "Entre 2 y 8 °C", "Entre 15 y 25 °C"], a: 1 },
        { q: "¿Cuál es un signo típico de hipoglucemia?", o: ["Sudoración fría y temblor", "Piel seca y caliente", "Aumento de la sed únicamente"], a: 0 },
        { q: "1.000 mL en 8 horas con macrogotero (20 gotas/mL) equivalen a…", o: ["21 gotas/min", "42 gotas/min", "63 gotas/min"], a: 1 },
        { q: "¿Con qué ángulo se aplica una inyección intramuscular?", o: ["10° a 15°", "45°", "90°"], a: 2 },
        { q: "Después de usar una aguja, usted debe…", o: ["Reencapucharla con cuidado", "Desecharla de inmediato en el contenedor rígido", "Guardarla hasta el final del turno"], a: 1 }
      ]
    }
  ];
  // Orden en el selector: de la entrada al cierre del curso
  var ORDER = ["diagnostica", "seleccion-simple", "verdadero-falso", "excepcion", "secuencia", "interpretacion", "calculo-dosis", "caso-clinico", "final-integrador"];
  window.ACAEMAT_EXAMS.sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });
})();
