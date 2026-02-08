const API="https://script.google.com/macros/s/AKfycbzC_qrSyXeTw9NcO40ap4x2cfs3FZIBKqMZLV9kKhYYh7n2XTPAuj1Vb2ckpFBWi8Ys/exec";

let productos=[];
let capturas=JSON.parse(localStorage.getItem("capturas")||"[]");
let scanner=null,modo=null,torch=false,editIndex=-1;

/* ===== BUFFER DEL ARCHIVO IMPORTADO ===== */
let bufferImportacion = JSON.parse(
  localStorage.getItem("bufferImportacion") || "null"
);

/* ===== ESTADO PERSISTENTE IMPORTACIÓN ===== */
let estadoImportacion = JSON.parse(
  localStorage.getItem("estadoImportacion") || "null"
);

/* ===== CARGA INICIAL ===== */
operador.value=localStorage.getItem("operador")||"";
ubicacion.value=localStorage.getItem("ubicacion")||"";

fetch(API).then(r=>r.json()).then(d=>{
 productos=d;
 localStorage.setItem("productos",JSON.stringify(d));
}).catch(()=>{
 const c=localStorage.getItem("productos");
 if(c) productos=JSON.parse(c);
});

render();

/* ===== RESTAURAR IMPORTACIÓN SI HUBO RECARGA ===== */
if (estadoImportacion && estadoImportacion.enProceso) {
  openTab("importar");
  barra.style.width = estadoImportacion.progreso + "%";
  mensaje.innerText = estadoImportacion.mensaje;
}

/* ===================== TABS ===================== */
function openTab(id){
 document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
 document.getElementById(id).classList.add('active');
}

/* ===================== CAPTURA ===================== */
function limpiarUbicacion(){
 ubicacion.value="";
 localStorage.removeItem("ubicacion");
 previewIngreso();
}

function buscarDescripcion(){
 const c=codigo.value.trim().toLowerCase();
 const p=productos.find(x=>String(x.CODIGO).toLowerCase()===c);
 if(p) descripcion.value=p.DESCRIPCION||"";
}

function previewIngreso(){
 if(!codigo.value && !descripcion.value){preview.innerHTML="";return;}
 preview.innerHTML=`<div class='row preview'><b>🕒 PREVISUALIZANDO</b><br><br>
 <b>${codigo.value||"-"}</b> – ${descripcion.value||"-"}<br>
 <span class='small'>${ubicacion.value||"SIN UBICACIÓN"} | ${operador.value||"-"} | Cant: ${cantidad.value}</span></div>`;
}

/* ===================== SCANNER CONTROLES ===================== */
function scanCodigo(){
  modo="codigo";
  abrirScanner();
}

function scanUbicacion(){
  modo="ubicacion";
  abrirScanner();
}

function toggleScanner(){
  if(scanner){
    cerrarScanner();
  }else{
    modo="codigo";
    abrirScanner();
  }
}

function abrirScanner(){
  if(scanner) return;

  scannerBox.style.display="block";

  // ⏳ esperar render del DOM
  setTimeout(()=>{
    scanner=new Html5Qrcode("scannerBox");

    scanner.start(
      {facingMode:"environment"},
      {
        fps:12,

        qrbox:(vw,vh)=>{
          const size=Math.min(vw,vh)*0.55;
          return {width:size,height:size};
        },

        formatsToSupport:[
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13
        ]
      },
      txt=>{
        beep.play();
        navigator.vibrate?.(200);

        if(modo==="codigo"){
          codigo.value=txt;
          buscarDescripcion();
          previewIngreso();
        }

        if(modo==="ubicacion"){
          ubicacion.value=txt;
          localStorage.setItem("ubicacion",txt);
          previewIngreso();
        }

        cerrarScanner();
      }
    );
  },200);
}

function cerrarScanner(){
 if(!scanner) return;
 scanner.stop().then(()=>{
  scanner.clear();
  scanner=null;
  scannerBox.style.display="none";
 });
}

function toggleTorch(){
 torch=!torch;
 scanner?.applyVideoConstraints({advanced:[{torch}]}).catch(()=>{});
}

/* ===================== GUARDAR ===================== */
function ingresar(){
 if(!codigo.value.trim()){
  alert("❌ Los datos no se pueden guardar. Digite un código correcto.");
  return;
 }

 localStorage.setItem("operador",operador.value);
 ubicacion.value
  ? localStorage.setItem("ubicacion",ubicacion.value)
  : localStorage.removeItem("ubicacion");

 const d={
  Fecha:new Date().toLocaleString(),
  Operador:operador.value||"",
  Ubicación:ubicacion.value||"SIN UBICACIÓN",
  Código:codigo.value,
  Descripción:descripcion.value,
  Cantidad:Number(cantidad.value)
 };

 if(editIndex>=0){
  capturas[editIndex]=d;
  editIndex=-1;
 }else{
  capturas.push(d);
 }

 localStorage.setItem("capturas",JSON.stringify(capturas));
 limpiar();
 render();
}

function cargarParaEditar(i){
 const c=capturas[i];
 operador.value=c.Operador;
 ubicacion.value=c.Ubicación==="SIN UBICACIÓN"?"":c.Ubicación;
 codigo.value=c.Código;
 descripcion.value=c.Descripción;
 cantidad.value=c.Cantidad;
 editIndex=i;
 previewIngreso();
 render();
 window.scrollTo({top:0,behavior:"smooth"});
}

function cancelarEdicion(){
 editIndex=-1;
 limpiar();
 render();
}

function limpiar(){
 codigo.value="";
 descripcion.value="";
 cantidad.value=1;
 preview.innerHTML="";
}

function render(){
 tabla.innerHTML="";
 let total=0;
 capturas.forEach((c,i)=>{
  total+=Number(c.Cantidad)||0;
  tabla.innerHTML+=`
  <div class='row ${editIndex===i?"editing":""}'>
   <button class='delbtn' onclick='event.stopPropagation();eliminarItem(${i})'>×</button>
   <div onclick='cargarParaEditar(${i})'>
    <b>${c.Código}</b> – ${c.Descripción}<br>
    <span class='small'>${c.Ubicación} | ${c.Operador} | ${c.Fecha} | Cant: ${c.Cantidad}</span>
   </div>
  </div>`;
 });
 totalizador.innerText="Total unidades: "+total;
}

function eliminarItem(i){
 if(!confirm("¿Eliminar este registro?")) return;
 capturas.splice(i,1);
 localStorage.setItem("capturas",JSON.stringify(capturas));
 if(editIndex===i) editIndex=-1;
 render();
}

/* ===================== FINALIZAR ===================== */
async function finalizar(){
 if(!capturas.length) return;

 const capturasExcel=capturas.map(r=>({
  ...r,
  Código:"'"+String(r.Código)
 }));

 const ws=XLSX.utils.json_to_sheet(capturasExcel);
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,ws,"Captura");
 const data=XLSX.write(wb,{bookType:"xlsx",type:"array"});

 const blob=new Blob([data],{
  type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
 });
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;
 a.download="captura.xlsx";
 a.click();

 localStorage.removeItem("capturas");
 capturas=[];
 limpiar();
 render();
 operador.value="";
 editIndex=-1;
}

/* ===================== IMPORTADOR ===================== */
function importarMaestra(){
 const file=fileExcel.files[0];

 if(!file && bufferImportacion){
  mensaje.innerText="ℹ️ Archivo ya cargado. Continuando importación…";
  enviarMaestra(bufferImportacion);
  return;
 }

 if(!file){
  alert("Selecciona Excel");
  return;
 }

 const reader=new FileReader();
 reader.onload=e=>{
  const wb=XLSX.read(e.target.result,{type:"binary"});
  const data=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  bufferImportacion=data;
  localStorage.setItem("bufferImportacion",JSON.stringify(bufferImportacion));

  mensaje.innerText="✅ Archivo cargado correctamente. Importando…";
  enviarMaestra(data);
 };
 reader.readAsBinaryString(file);
}

async function enviarMaestra(data){
 estadoImportacion={
  enProceso:true,
  progreso:0,
  mensaje:"⏳ Importando..."
 };
 localStorage.setItem("estadoImportacion",JSON.stringify(estadoImportacion));

 barra.style.width="0%";
 mensaje.innerText=estadoImportacion.mensaje;

 let p=0;
 const t=setInterval(()=>{
  p+=10;
  barra.style.width=p+"%";
  estadoImportacion.progreso=p;
  localStorage.setItem("estadoImportacion",JSON.stringify(estadoImportacion));
  if(p>=90) clearInterval(t);
 },200);

 try{
  await fetch(API,{
   method:"POST",
   body:JSON.stringify({accion:"importar",data})
  });

  clearInterval(t);
  barra.style.width="100%";
  mensaje.innerText="✅ Importación de archivo exitosa";
  alert("✅ Importación de archivo exitosa");

  localStorage.removeItem("estadoImportacion");
  localStorage.removeItem("bufferImportacion");
  estadoImportacion=null;
  bufferImportacion=null;
  if(fileExcel) fileExcel.value="";

  productos=data;

 }catch(e){
  clearInterval(t);
  mensaje.innerText="❌ Error al importar";
  estadoImportacion.mensaje=mensaje.innerText;
  localStorage.setItem("estadoImportacion",JSON.stringify(estadoImportacion));
 }
}

/* ===== PROTEGER RECARGA ===== */
window.addEventListener("beforeunload",e=>{
 const est=JSON.parse(localStorage.getItem("estadoImportacion")||"null");
 if(est && est.enProceso){
  e.preventDefault();
  e.returnValue="";
 }
});
