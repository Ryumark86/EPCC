(function () {
    'use strict';

    var CONFIG = {
        HISTORY_KEY: 'sitoc_epcc_v2',
        PENDING_KEY: 'sitoc_epcc_pendientes'
    };

    var TELEGRAM_TOKEN = '8156531980:AAE_a4ajq0tz8NwhQYHxyC0dJwwoQxeuG18';
    var TELEGRAM_CHAT_ID = '-1003710822074';

    var toastTimer = null;
    var CARACT_NAMES = ['Elemento certificado', 'Tiene etiqueta', 'La etiqueta est\u00e1 legible', 'Buen estado general'];

    var SECCIONES_MAL_EXCEL = [
        {
            titulo: '1. Componentes Textiles e Hilos (Arn\u00e9s, Eslingas, L\u00edneas)',
            key: 'textiles',
            items: [
                'Correas de hombros (Deterioro / Cortes / Desgaste / Quemaduras)',
                'Correas tirantes (Fibras con corte / Desgaste / Abrasi\u00f3n)',
                'Correas de muslos / perneras (Cortes / Suciedad extrema / Mal olor)',
                'Correa subp\u00e9lvica / banda subgl\u00fatea (Estiramiento excesivo / Da\u00f1o)',
                'Costuras de correas de hombros (Hilos sueltos / Abiertas / Rotas)',
                'Costuras de correas de muslos (Hilos sueltos / Abiertas / Rotas)',
                'Extremos de correas de hombros (Deshilachados / Da\u00f1os por calor)',
                'Extremos de correas de muslos (Deshilachados / Da\u00f1os por calor)',
                'L\u00ednea de vida vertical (Desgaste / Nudos no autorizados / Alma expuesta)',
                'L\u00ednea de vida horizontal (Desgaste / Cortes / Marcas de corrosi\u00f3n)',
                'Eslinga de posicionamiento (Acartonamiento / Quemaduras / Da\u00f1o qu\u00edmico)',
                'Eslinga de sujeci\u00f3n (Cortes / Costuras abiertas o rotas / Desgaste)'
            ]
        },
        {
            titulo: '2. Absorbedor de Impacto',
            key: 'absorbedor',
            items: [
                'Deterioro general o suciedad extrema',
                '\u00a1El absorbedor ha sido activado / elongado / desplegado!',
                'Funda protectora rota, con grietas o ausente',
                'Costuras de seguridad rotas o desgarradas',
                'Picaduras o marcas de corrosi\u00f3n / qu\u00edmicos',
                'Ajusta o funciona de manera incorrecta'
            ]
        },
        {
            titulo: '3. Herrajes Met\u00e1licos y Pl\u00e1sticos',
            key: 'herrajes',
            items: [
                'Argolla en D frontal (Deformaciones / Grietas / Corrosi\u00f3n)',
                'Argolla en D dorsal / espalda (Deformaciones / Grietas / Corrosi\u00f3n)',
                'Argollas en D en caderas / sujeci\u00f3n (Bordes filosos / Desgaste >10%)',
                'Buje de argollas (Fisuras / Desgaste o picaduras)',
                'Hebilla hexagonal dorsal pl\u00e1stica (Deformaci\u00f3n / Rota / Partida)',
                'Hebillas de graduaci\u00f3n pl\u00e1sticas (Grietas / Rotas o vencidas)',
                'Hebillas de ajuste o trabilla - pl\u00e1stica o met\u00e1lica (Sueltas / Mal ajuste)',
                'Hebillas de graduaci\u00f3n met\u00e1licas (Corrosi\u00f3n profunda / Dobleces)',
                'Hebillas de conexi\u00f3n met\u00e1licas en muslos (Mal funcionamiento / \u00d3xido)',
                'Ganchos y/o mosquetones (Resorte da\u00f1ado / No cierra / Desgaste)',
                'Arrestador de ca\u00edda o "Carrito" met\u00e1lico (Mal funcionamiento / Ajuste mal)',
                'Remaches - si existen (Flojos / Oxidados / Ausentes)'
            ]
        }
    ];

    var formState = {
        coordTSA: null,
        tecnicos: []
    };

    var canvas, ctx, dibujando = false;
    var canvasesTec = {};

    function $(id) { return document.getElementById(id); }

    function escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function checkDependencies() {
        var ids = ['screen-form', 'screen-historial', 'screen-detalle', 'toast', 'firmaCanvas', 'contenedor-tecnicos', 'historial-lista', 'detalleContenido', 'btn-eliminar-reg'];
        var missing = [];
        ids.forEach(function (id) {
            if (!$(id)) missing.push(id);
        });
        if (missing.length > 0) {
            console.error('Elementos faltantes en el DOM:', missing.join(', '));
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initCanvasFirma();
        resetFormularioUI();
        updatePendingUI();
        checkDependencies();
    });

    function setCoord(val) {
        formState.coordTSA = val;
        $('coord-SI').className = val ? 'yn-btn sel-si' : 'yn-btn';
        $('coord-NO').className = !val ? 'yn-btn sel-no' : 'yn-btn';
    }

    function findTecnico(tecUid) {
        return formState.tecnicos.find(function (t) { return t.uid === tecUid; });
    }

    function findEquipo(eqUid) {
        for (var i = 0; i < formState.tecnicos.length; i++) {
            var found = formState.tecnicos[i].equipos.find(function (e) { return e.uid === eqUid; });
            if (found) return found;
        }
        return null;
    }

    function findTecnicoPorEquipo(eqUid) {
        for (var i = 0; i < formState.tecnicos.length; i++) {
            if (formState.tecnicos[i].equipos.some(function (e) { return e.uid === eqUid; })) {
                return formState.tecnicos[i];
            }
        }
        return null;
    }

    function setEqCaract(eqUid, name, val) {
        var eq = findEquipo(eqUid);
        if (!eq) return;
        eq.caracts[name] = val;
        var idSi = 'ec-si-' + btoa(eqUid + '_' + name);
        var idNo = 'ec-no-' + btoa(eqUid + '_' + name);
        var elSi = $(idSi);
        var elNo = $(idNo);
        if (elSi) elSi.className = val === 'SI' ? 'mini-btn sel-si' : 'mini-btn';
        if (elNo) elNo.className = val === 'NO' ? 'mini-btn sel-no' : 'mini-btn';
    }

    function generarHtmlCaracts(eqUid) {
        var html = '<div class="eq-caracts" style="margin-top:8px;border-top:1px dashed var(--gray3);padding-top:8px;">';
        html += '  <span style="font-size:10px;font-weight:bold;color:var(--navy);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.02em;">Caracter\u00edsticas de Certificaci\u00f3n General</span>';
        html += '  <div style="border:1px solid var(--gray2);border-radius:6px;padding:6px;background:var(--white)">';
        CARACT_NAMES.forEach(function (caract) {
            var idSi = 'ec-si-' + btoa(eqUid + '_' + caract);
            var idNo = 'ec-no-' + btoa(eqUid + '_' + caract);
            html += '    <div class="eq-row">';
            html += '      <div class="eq-nombre" style="font-size:11px;">' + caract + '</div>';
            html += '      <div class="mini-yn">';
            html += '        <div class="mini-btn sel-si" id="' + idSi + '" onclick="window._setEqCaract(\'' + eqUid + '\',\'' + caract + '\',\'SI\')">S\u00cd</div>';
            html += '        <div class="mini-btn" id="' + idNo + '" onclick="window._setEqCaract(\'' + eqUid + '\',\'' + caract + '\',\'NO\')">NO</div>';
            html += '      </div>';
            html += '    </div>';
        });
        html += '  </div>';
        html += '</div>';
        return html;
    }

    function toggleNoAplica(chk, eqUid) {
        var eqItem = chk.closest('.equipo-item');
        var checked = chk.checked;
        eqItem.classList.toggle('no-aplica', checked);
        var eq = findEquipo(eqUid);
        if (eq) eq.noAplica = checked;
    }

    function agregarTecnico() {
        var contenedor = $('contenedor-tecnicos');
        var tecUid = 'tec_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        formState.tecnicos.push({
            uid: tecUid,
            nombre: '',
            cedula: '',
            telefono: '',
            equipos: [],
            fotos: [],
            malEstado: {},
            firma: null
        });

        var block = document.createElement('div');
        block.className = 'tecnico-block';
        block.setAttribute('data-tecuid', tecUid);

        var num = contenedor.children.length + 1;
        var html = '';

        html += '<div class="tecnico-header">';
        html += '  <span class="tecnico-numero">T\u00e9cnico #' + num + '</span>';
        html += '  <button type="button" class="btn-remove-tec" onclick="window._eliminarTec(this)" style="background:none;border:none;color:var(--danger);font-weight:bold;cursor:pointer;font-size:12px;">\u274c Quitar T\u00e9cnico</button>';
        html += '</div>';

        html += '<div class="tecnico-grid">';
        html += '  <div><label style="display:block;font-size:11px;color:var(--text2);font-weight:600;">Nombre Completo</label><input type="text" class="tec-nombre" placeholder="Nombre del t\u00e9cnico evaluado"></div>';
        html += '  <div><label style="display:block;font-size:11px;color:var(--text2);font-weight:600;">C\u00e9dula</label><input type="text" class="tec-cedula" placeholder="C\u00e9dula"></div>';
        html += '  <div><label style="display:block;font-size:11px;color:var(--text2);font-weight:600;">Tel\u00e9fono</label><input type="text" class="tec-telefono" placeholder="Tel\u00e9fono"></div>';
        html += '</div>';

        html += '<div class="tecnico-equipos" data-tecuid="' + tecUid + '"></div>';

        html += '<button type="button" class="btn-add-eq" onclick="window._agregarEq(this)" data-tecuid="' + tecUid + '">\u2795 A\u00f1adir Equipo</button>';

        html += '<div class="tecnico-section-title">\ud83d\udcf7 Registro Fotogr\u00e1fico del T\u00e9cnico (FHD)</div>';
        html += '<div class="photo-container">';
        html += '  <button type="button" class="btn btn-outline btn-upload-photo" style="padding:8px;font-size:12px;margin-top:0;" onclick="document.getElementById(\'file-tec-' + tecUid + '\').click()">\ud83d\udcf7 Tomar Foto (Hallazgo / Evidencia)</button>';
        html += '  <input type="file" id="file-tec-' + tecUid + '" accept="image/*" capture="environment" style="display:none" onchange="window._capturarFotoTec(this,\'' + tecUid + '\')">';
        html += '  <div class="photo-grid" id="preview-tec-' + tecUid + '"></div>';
        html += '</div>';

        html += '<div class="tecnico-section-title" style="margin-top:2px;">\ud83d\udd0d Lista de Verificaci\u00f3n de Componentes (Marque solo los que presenten DEFECTOS)</div>';
        html += '<div class="tecnico-checklist" data-tecuid="' + tecUid + '">';
        SECCIONES_MAL_EXCEL.forEach(function (g) {
            html += '  <div class="mal-grupo">';
            html += '    <div class="mal-grupo-titulo">' + g.titulo + '</div>';
            g.items.forEach(function (item, ii) {
                var idInput = 'chk_' + tecUid + '_' + g.key + '_' + ii;
                html += '    <div class="mal-item">';
                html += '      <input type="checkbox" class="chk chk-mal" id="' + idInput + '" data-key="' + g.key + '_' + ii + '" data-text="' + g.titulo.split('. ')[1] + ': ' + item + '">';
                html += '      <label class="mal-item-label" for="' + idInput + '">' + item + '</label>';
                html += '    </div>';
            });
            html += '  </div>';
        });
        html += '</div>';

        html += '<div class="tecnico-section-title">\u2712\ufe0f Firma del T\u00e9cnico Evaluado</div>';
        html += '<div class="firma-tec-wrap">';
        html += '  <canvas id="firmaTec-' + tecUid + '" height="150"></canvas>';
        html += '  <div class="firma-hint">Dibuje su firma digital dentro del recuadro</div>';
        html += '</div>';
        html += '<button class="btn btn-outline" style="padding:8px;font-size:13px;margin-top:8px;" onclick="window._limpiarFirmaTec(\'' + tecUid + '\')">Limpiar Firma</button>';

        block.innerHTML = html;
        contenedor.appendChild(block);

        initCanvasFirmaTecnico(tecUid);

        var eqContainer = block.querySelector('.tecnico-equipos');
        var defaultNombres = ['Arn\u00e9s de cuerpo completo', 'Eslinga en Y', 'Eslinga de posicionamiento'];
        defaultNombres.forEach(function (nombre) {
            agregarEquipoToDOM(eqContainer, tecUid, nombre);
        });

        actualizarNumeracionTecnicos();

        if (contenedor.children.length <= 1) {
            var btnRem = block.querySelector('.btn-remove-tec');
            if (btnRem) btnRem.style.display = 'none';
        }
    }

    function agregarEquipoToDOM(container, tecUid, defaultName) {
        var eqUid = 'eq_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        var tec = findTecnico(tecUid);
        if (tec) {
            tec.equipos.push({
                uid: eqUid,
                nombre: defaultName || '',
                marca: '',
                serial: '',
                lote: '',
                fecha: '',
                caracts: { "Elemento certificado": "SI", "Tiene etiqueta": "SI", "La etiqueta est\u00e1 legible": "SI", "Buen estado general": "SI" },
                noAplica: false
            });
        }

        var eqDiv = document.createElement('div');
        eqDiv.className = 'equipo-item';
        eqDiv.setAttribute('data-equid', eqUid);

        var items = container.querySelectorAll('.equipo-item');
        var num = items.length + 1;

        var h = '';
        h += '<div class="eq-header">';
        h += '  <span class="equipo-numero">Equipo #' + num + '</span>';
        h += '  <div style="display:flex;align-items:center;gap:8px;">';
        h += '    <label class="eq-no-aplica" style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:3px;cursor:pointer;">';
        h += '      <input type="checkbox" onchange="window._toggleNoAplica(this,\'' + eqUid + '\')"> No aplica';
        h += '    </label>';
        h += '    <button type="button" onclick="window._eliminarEq(this)" style="background:none;border:none;color:var(--danger);font-weight:bold;cursor:pointer;font-size:11px;">\u2715</button>';
        h += '  </div>';
        h += '</div>';

        h += '<div style="margin-bottom:6px;">';
        h += '  <label style="display:block;font-size:10px;color:var(--text2);font-weight:600;">Nombre del Equipo:</label>';
        h += '  <input type="text" class="eq-nombre-eq" value="' + escHtml(defaultName || '') + '" placeholder="Ej. Arn\u00e9s Multiprop\u00f3sito" style="padding:5px 6px;font-size:12px;width:100%;">';
        h += '</div>';

        h += '<div class="eq-datos">';
        h += '  <div><label style="display:block;font-size:10px;color:var(--text2);font-weight:600;">Marca:</label><input type="text" class="eq-marca" style="padding:5px 6px;font-size:12px;"></div>';
        h += '  <div><label style="display:block;font-size:10px;color:var(--text2);font-weight:600;">Serial:</label><input type="text" class="eq-serial" style="padding:5px 6px;font-size:12px;"></div>';
        h += '  <div><label style="display:block;font-size:10px;color:var(--text2);font-weight:600;">Lote:</label><input type="text" class="eq-lote" style="padding:5px 6px;font-size:12px;"></div>';
        h += '  <div><label style="display:block;font-size:10px;color:var(--text2);font-weight:600;">F. Fabricaci\u00f3n:</label><input type="text" class="eq-fecha" placeholder="06/2026" style="padding:5px 6px;font-size:12px;"></div>';
        h += '</div>';

        h += generarHtmlCaracts(eqUid);

        eqDiv.innerHTML = h;
        container.appendChild(eqDiv);

        actualizarNumeracionEquipos(container);
    }

    function eliminarTecnico(btn) {
        var block = btn.closest('.tecnico-block');
        var tecUid = block.getAttribute('data-tecuid');
        formState.tecnicos = formState.tecnicos.filter(function (t) { return t.uid !== tecUid; });
        if (canvasesTec[tecUid]) delete canvasesTec[tecUid];
        block.remove();
        actualizarNumeracionTecnicos();
        var contenedor = $('contenedor-tecnicos');
        if (contenedor.children.length <= 1) {
            contenedor.querySelectorAll('.btn-remove-tec').forEach(function (b) { b.style.display = 'none'; });
        } else {
            contenedor.querySelectorAll('.btn-remove-tec').forEach(function (b) { b.style.display = ''; });
        }
    }

    function eliminarEquipo(btn) {
        var eqItem = btn.closest('.equipo-item');
        var eqUid = eqItem.getAttribute('data-equid');
        var tecBlock = btn.closest('.tecnico-block');
        var tecUid = tecBlock.getAttribute('data-tecuid');
        var tec = findTecnico(tecUid);
        if (tec) {
            tec.equipos = tec.equipos.filter(function (e) { return e.uid !== eqUid; });
        }
        var container = eqItem.parentElement;
        eqItem.remove();
        actualizarNumeracionEquipos(container);
    }

    function agregarEquipo(btn) {
        var tecBlock = btn.closest('.tecnico-block');
        var tecUid = tecBlock.getAttribute('data-tecuid');
        var container = tecBlock.querySelector('.tecnico-equipos');
        agregarEquipoToDOM(container, tecUid, '');
    }

    function actualizarNumeracionTecnicos() {
        var contenedor = $('contenedor-tecnicos');
        var blocks = contenedor.querySelectorAll('.tecnico-block');
        blocks.forEach(function (block, i) {
            var numSpan = block.querySelector('.tecnico-numero');
            if (numSpan) numSpan.innerText = 'T\u00e9cnico #' + (i + 1);
        });
    }

    function actualizarNumeracionEquipos(container) {
        var items = container.querySelectorAll('.equipo-item');
        items.forEach(function (item, i) {
            var numSpan = item.querySelector('.equipo-numero');
            if (numSpan) numSpan.innerText = 'Equipo #' + (i + 1);
        });
    }

    function initCanvasFirmaTecnico(tecUid) {
        var cvs = $('firmaTec-' + tecUid);
        if (!cvs) return;
        var c = cvs.getContext('2d');
        c.strokeStyle = '#0d2b4e';
        c.lineWidth = 2.5;
        c.lineCap = 'round';
        var dibujandoTec = false;

        function ajustar() {
            var w = cvs.parentElement.clientWidth;
            cvs.width = w;
            c.strokeStyle = '#0d2b4e';
            c.lineWidth = 2.5;
            c.lineCap = 'round';
        }
        ajustar();

        cvs.addEventListener('mousedown', function (e) {
            dibujandoTec = true;
            c.beginPath();
            c.moveTo(e.offsetX, e.offsetY);
        });
        cvs.addEventListener('mousemove', function (e) {
            if (dibujandoTec) { c.lineTo(e.offsetX, e.offsetY); c.stroke(); }
        });
        cvs.addEventListener('mouseup', function () { dibujandoTec = false; });
        cvs.addEventListener('mouseleave', function () { dibujandoTec = false; });

        cvs.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                dibujandoTec = true;
                var t = e.touches[0];
                var r = cvs.getBoundingClientRect();
                c.beginPath();
                c.moveTo(t.clientX - r.left, t.clientY - r.top);
                e.preventDefault();
            }
        }, { passive: false });
        cvs.addEventListener('touchmove', function (e) {
            if (dibujandoTec && e.touches.length === 1) {
                var t = e.touches[0];
                var r = cvs.getBoundingClientRect();
                c.lineTo(t.clientX - r.left, t.clientY - r.top);
                c.stroke();
                e.preventDefault();
            }
        }, { passive: false });
        cvs.addEventListener('touchend', function () { dibujandoTec = false; });

        canvasesTec[tecUid] = { canvas: cvs, ctx: c };
    }

    function limpiarFirmaTecnico(tecUid) {
        var obj = canvasesTec[tecUid];
        if (obj) obj.ctx.clearRect(0, 0, obj.canvas.width, obj.canvas.height);
    }

    function firmaTecVacia(tecUid) {
        var obj = canvasesTec[tecUid];
        if (!obj) return true;
        var buffer = new Uint32Array(obj.ctx.getImageData(0, 0, obj.canvas.width, obj.canvas.height).data.buffer);
        return !buffer.some(function (color) { return color !== 0; });
    }

    function getFirmaTecData(tecUid) {
        var obj = canvasesTec[tecUid];
        return obj ? obj.canvas.toDataURL() : null;
    }

    function capturarFotoTecnico(input, tecUid) {
        if (!input.files || input.files.length === 0) return;

        Array.from(input.files).forEach(function (file) {
            var lector = new FileReader();
            lector.onload = function (eventoRaiz) {
                var img = new Image();
                img.onload = function () {
                    var sitio = $('insSitio').value.trim() || 'No especificado';
                    var ahora = new Date();
                    var fechaHoraStr = ahora.toLocaleDateString('es-CO') + ' ' + ahora.toLocaleTimeString('es-CO');

                    if (navigator.geolocation) {
                        showToast('\ud83d\udce1 Fijando coordenadas por sat\u00e9lite...');
                        navigator.geolocation.getCurrentPosition(
                            function (position) {
                                var lat = position.coords.latitude.toFixed(6);
                                var lon = position.coords.longitude.toFixed(6);
                                var geoStr = "Lat: " + lat + ", Lon: " + lon;
                                procesarFotoTecnico(img, fechaHoraStr, geoStr, sitio, tecUid);
                            },
                            function (error) {
                                var causa = "";
                                if (error.code === error.PERMISSION_DENIED) causa = "Permiso denegado. Debe autorizar el acceso al GPS.";
                                else if (error.code === error.POSITION_UNAVAILABLE) causa = "Se\u00f1al satelital no disponible.";
                                else if (error.code === error.TIMEOUT) causa = "Tiempo de espera agotado.";
                                alert("\u274c RECHAZO DE SEGURIDAD:\n" + causa + "\n\n\u26a0\ufe0f Las coordenadas geogr\u00e1ficas son OBLIGATORIAS para certificar evidencias!");
                                showToast("\u26a0\ufe0f Foto rechazada por falta de GPS", "warning");
                            },
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                        );
                    } else {
                        alert("\u274c ERROR HARDWARE:\nSu dispositivo no cuenta con hardware de geolocalizaci\u00f3n.");
                    }
                };
                img.src = eventoRaiz.target.result;
            };
            lector.readAsDataURL(file);
        });
        input.value = '';
    }

    function procesarFotoTecnico(img, fechaHora, gps, sitio, tecUid) {
        var canvasStamp = document.createElement('canvas');
        var maxDim = 1920;
        var ancho = img.width;
        var alto = img.height;

        if (ancho > alto) {
            if (ancho > maxDim) { alto *= maxDim / ancho; ancho = maxDim; }
        } else {
            if (alto > maxDim) { ancho *= maxDim / alto; alto = maxDim; }
        }

        canvasStamp.width = ancho;
        canvasStamp.height = alto;
        var c = canvasStamp.getContext('2d');
        c.drawImage(img, 0, 0, ancho, alto);

        var altoFranja = Math.max(60, Math.round(alto * 0.07));
        c.fillStyle = "rgba(0,0,0,0.65)";
        c.fillRect(0, alto - altoFranja, ancho, altoFranja);
        c.fillStyle = "#ffffff";
        c.font = "bold " + Math.max(12, Math.round(ancho * 0.018)) + "px -apple-system, sans-serif";
        c.textBaseline = "top";
        c.fillText("\ud83d\udcc5 " + fechaHora + "   \ud83d\udccd " + gps, 14, alto - altoFranja + 10);
        c.fillText("\ud83c\udfe2 Obra/Sitio: " + sitio, 14, alto - altoFranja + altoFranja * 0.5 + 4);

        var b64 = canvasStamp.toDataURL('image/jpeg', 0.55);

        var tec = findTecnico(tecUid);
        if (tec) {
            tec.fotos.push(b64);
            renderizarFotosTecnico(tecUid);
        }
    }

    function renderizarFotosTecnico(tecUid) {
        var contenedor = $('preview-tec-' + tecUid);
        if (!contenedor) return;
        contenedor.innerHTML = '';

        var tec = findTecnico(tecUid);
        if (!tec) return;

        tec.fotos.forEach(function (base64, idx) {
            var wrap = document.createElement('div');
            wrap.className = 'photo-thumb-wrap';
            var img = document.createElement('img');
            img.src = base64;
            img.onclick = function () { abrirHdLightbox(this.src); };
            var btnBorrar = document.createElement('button');
            btnBorrar.className = 'photo-delete-btn';
            btnBorrar.type = 'button';
            btnBorrar.innerHTML = '\u2715';
            btnBorrar.onclick = function (e) {
                e.stopPropagation();
                tec.fotos.splice(idx, 1);
                renderizarFotosTecnico(tecUid);
            };
            wrap.appendChild(img);
            wrap.appendChild(btnBorrar);
            contenedor.appendChild(wrap);
        });
    }

    function initCanvasFirma() {
        canvas = $('firmaCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0d2b4e';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';

        function ajustarAnchoCanvas() {
            var width = canvas.parentElement.clientWidth;
            canvas.width = width;
            ctx.strokeStyle = '#0d2b4e';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
        }
        ajustarAnchoCanvas();
        window.addEventListener('resize', ajustarAnchoCanvas);

        canvas.addEventListener('mousedown', function (e) {
            dibujando = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY);
        });
        canvas.addEventListener('mousemove', function (e) {
            if (dibujando) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); }
        });
        window.addEventListener('mouseup', function () { dibujando = false; });

        canvas.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                dibujando = true;
                var t = e.touches[0];
                var r = canvas.getBoundingClientRect();
                ctx.beginPath(); ctx.moveTo(t.clientX - r.left, t.clientY - r.top);
                e.preventDefault(); e.stopPropagation();
            }
        }, { passive: false });
        canvas.addEventListener('touchmove', function (e) {
            if (dibujando && e.touches.length === 1) {
                var t = e.touches[0];
                var r = canvas.getBoundingClientRect();
                ctx.lineTo(t.clientX - r.left, t.clientY - r.top); ctx.stroke();
                e.preventDefault(); e.stopPropagation();
            }
        }, { passive: false });
        canvas.addEventListener('touchend', function () { dibujando = false; });
    }

    function limpiarFirma() {
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function firmaVacia() {
        if (!ctx) return true;
        var buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        return !buffer.some(function (color) { return color !== 0; });
    }

    function resetFormularioUI() {
        $('insFecha').value = new Date().toISOString().split('T')[0];
        $('insInspector').value = '';
        $('insCedula').value = '';
        $('insTelefono').value = '';
        $('insSitio').value = '';
        $('insObs').value = '';
        setCoord(null);
        formState.tecnicos = [];
        canvasesTec = {};
        $('contenedor-tecnicos').innerHTML = '';
        agregarTecnico();
        limpiarFirma();
    }

    function getRegs() {
        return JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
    }

    function guardarFormulario() {
        var fecha = $('insFecha').value;
        var inspector = $('insInspector').value.trim();
        var cedula = $('insCedula').value.trim();
        var telefono = $('insTelefono').value.trim();
        var sitio = $('insSitio').value.trim();
        var obs = $('insObs').value.trim();

        if (!fecha || !inspector || !cedula || !telefono || !sitio) {
            showToast('\u26a0\ufe0f Complete todos los datos obligatorios del bloque de control', 'warning');
            return;
        }
        if (formState.coordTSA === null) {
            showToast('\u26a0\ufe0f Especifique si es Coordinador de TSA', 'warning');
            return;
        }
        if (firmaVacia()) {
            showToast('\u26a0\ufe0f Es obligatoria la firma del inspector', 'warning');
            return;
        }

        var tecnicosData = [];
        var tieneDefectosGlobal = false;
        var tecBlocks = document.querySelectorAll('.tecnico-block');

        for (var t = 0; t < tecBlocks.length; t++) {
            var block = tecBlocks[t];
            var tecUid = block.getAttribute('data-tecuid');

            var nombreTec = block.querySelector('.tec-nombre').value.trim();
            var cedulaTec = block.querySelector('.tec-cedula').value.trim();
            var telefonoTec = block.querySelector('.tec-telefono').value.trim();

            if (!nombreTec || !cedulaTec || !telefonoTec) {
                showToast('\u26a0\ufe0f Complete nombre, c\u00e9dula y tel\u00e9fono del T\u00e9cnico #' + (t + 1), 'warning');
                return;
            }

            if (firmaTecVacia(tecUid)) {
                showToast('\u26a0\ufe0f Es obligatoria la firma del T\u00e9cnico #' + (t + 1), 'warning');
                return;
            }

            var equiposList = [];
            var eqItems = block.querySelectorAll('.equipo-item');
            for (var e = 0; e < eqItems.length; e++) {
                var eqEl = eqItems[e];
                var eqUid = eqEl.getAttribute('data-equid');
                var noAplicaChk = eqEl.querySelector('.eq-no-aplica input');
                var noAplica = noAplicaChk ? noAplicaChk.checked : false;

                if (noAplica) continue;

                var eqData = {
                    uid: eqUid,
                    nombre: eqEl.querySelector('.eq-nombre-eq').value.trim(),
                    marca: eqEl.querySelector('.eq-marca').value.trim(),
                    serial: eqEl.querySelector('.eq-serial').value.trim(),
                    lote: eqEl.querySelector('.eq-lote').value.trim(),
                    fecha: eqEl.querySelector('.eq-fecha').value.trim(),
                    noAplica: false,
                    caracts: {}
                };

                var eq = findEquipo(eqUid);
                if (eq) {
                    eqData.caracts = JSON.parse(JSON.stringify(eq.caracts));
                }

                equiposList.push(eqData);
            }

            var malEstado = {};
            block.querySelectorAll('.chk-mal:checked').forEach(function (chk) {
                malEstado[chk.dataset.key] = true;
                tieneDefectosGlobal = true;
            });

            var tecState = findTecnico(tecUid);

            tecnicosData.push({
                nombre: nombreTec,
                cedula: cedulaTec,
                telefono: telefonoTec,
                equipos: equiposList,
                fotos: tecState ? JSON.parse(JSON.stringify(tecState.fotos)) : [],
                malEstado: malEstado,
                firma: getFirmaTecData(tecUid)
            });
        }

        if (tecnicosData.length === 0) {
            showToast('\u26a0\ufe0f Debe haber al menos un t\u00e9cnico registrado', 'warning');
            return;
        }

        var registro = {
            id: Date.now().toString(),
            fecha: fecha,
            inspector: inspector,
            cedula: cedula,
            telefono: telefono,
            sitio: sitio,
            coordTSA: formState.coordTSA,
            tecnicos: tecnicosData,
            observaciones: obs,
            firma: canvas.toDataURL(),
            aprobado: !tieneDefectosGlobal
        };

        var regs = getRegs();
        regs.unshift(registro);
        localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(regs));

        var nombreArchivo = 'EPCC_' + sitio.replace(/[/\\?%*:|"<> ]/g, '_') + '_' + fecha + '.html';

        var htmlReporte = generarReporteHtml(registro);
        var blob = new Blob([htmlReporte], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);

        showToast('\u2705 Inspecci\u00f3n guardada \u2013 Enviando reporte...', 'success');
        enviarTelegram(registro.id);
        resetFormularioUI();
        showScreen('historial');
    }

    function renderLegacyEquipos(r) {
        var html = '<div class="card"><div class="card-title"><div class="icon">\ud83d\udce6</div>Detalle Cl\u00ednico de Equipos (Registro Anterior)</div>';
        r.equipos.forEach(function (eq, idx) {
            var eqAprobadoColor = eq.approved ? 'var(--success)' : 'var(--danger)';
            var eqAprobadoTexto = eq.approved ? '\u2713 Conforme' : '\u26a0\ufe0f No Conforme';
            html += '<div style="background:var(--gray);padding:12px;border-radius:8px;margin-bottom:12px;font-size:12px;border:1px solid var(--gray2);">';
            html += '  <div style="display:flex;justify-content:space-between;font-weight:bold;color:var(--navy);margin-bottom:6px;border-bottom:1px solid var(--gray3);padding-bottom:4px;">';
            html += '    <span>Equipo #' + (idx + 1) + (eq.nombre ? ' \u2014 ' + eq.nombre : '') + '</span>';
            html += '    <span style="color:' + eqAprobadoColor + '">' + eqAprobadoTexto + '</span>';
            html += '  </div>';
            html += '  <div class="info-grid" style="margin-bottom:8px;">';
            html += '    <div class="info-cell"><span>Marca:</span><strong>' + escHtml(eq.marca || '\u2014') + '</strong></div>';
            html += '    <div class="info-cell"><span>Serial:</span><strong>' + escHtml(eq.serial || '\u2014') + '</strong></div>';
            html += '    <div class="info-cell"><span>Lote:</span><strong>' + escHtml(eq.lote || '\u2014') + '</strong></div>';
            html += '    <div class="info-cell"><span>F.Fabricaci\u00f3n:</span><strong>' + escHtml(eq.fecha || '\u2014') + '</strong></div>';
            html += '  </div>';
            if (eq.caracts) {
                html += '  <div style="border:1px solid var(--gray3);border-radius:6px;padding:6px;background:white;margin-bottom:6px;">';
                Object.keys(eq.caracts).forEach(function (c) {
                    var v = eq.caracts[c];
                    var c2 = v === 'SI' ? 'var(--success)' : (v === 'NO' ? 'var(--danger)' : 'var(--text2)');
                    html += '    <div style="display:flex;justify-content:space-between;font-size:11px;border-bottom:1px solid var(--gray2);padding:2px 4px;"><span>' + c + '</span><span style="font-weight:bold;color:' + c2 + '">' + v + '</span></div>';
                });
                html += '  </div>';
            }
            var defectos = [];
            SECCIONES_MAL_EXCEL.forEach(function (g) {
                g.items.forEach(function (item, ii) {
                    var dataKey = g.key + '_' + ii;
                    if (eq.malEstado && eq.malEstado[dataKey]) {
                        defectos.push(g.titulo.split(' ')[1] + ': ' + item);
                    }
                });
            });
            if (defectos.length > 0) {
                html += '  <div style="padding:6px;background:white;border-radius:6px;border-left:3px solid var(--danger);margin-top:6px;">';
                html += '    <span style="font-weight:bold;color:var(--danger);font-size:10px;">Defectos:</span>';
                defectos.forEach(function (d) { html += '    <div style="font-size:10px;color:var(--danger);">\u274c ' + d + '</div>'; });
                html += '  </div>';
            }
            if ((eq.fotosEquipos && eq.fotosEquipos.length > 0) || (eq.fotosSeriales && eq.fotosSeriales.length > 0)) {
                html += '  <div style="margin-top:6px;">';
                if (eq.fotosEquipos && eq.fotosEquipos.length > 0) {
                    html += '    <span style="font-size:10px;font-weight:600;color:var(--text2);">Fotos:</span><div class="photo-grid">';
                    eq.fotosEquipos.forEach(function (b64) {
                        html += '    <div style="border:1px solid var(--gray3);border-radius:6px;overflow:hidden;background:#000;"><img src="' + b64 + '" style="width:100%;height:auto;display:block;cursor:zoom-in;" onclick="window.abrirHdLightbox(this.src)"></div>';
                    });
                    html += '    </div>';
                }
                if (eq.fotosSeriales && eq.fotosSeriales.length > 0) {
                    html += '    <span style="font-size:10px;font-weight:600;color:var(--text2);">Seriales:</span><div class="photo-grid">';
                    eq.fotosSeriales.forEach(function (b64) {
                        html += '    <div style="border:1px solid var(--gray3);border-radius:6px;overflow:hidden;background:#000;"><img src="' + b64 + '" style="width:100%;height:auto;display:block;cursor:zoom-in;" onclick="window.abrirHdLightbox(this.src)"></div>';
                    });
                    html += '    </div>';
                }
                html += '  </div>';
            }
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function verDetalle(id) {
        var r = getRegs().find(function (reg) { return reg.id === id; });
        if (!r) return;

        var html = '';
        var estadoTexto = r.aprobado ? 'CONFORME (Buen estado global)' : 'NO CONFORME (Se detectaron fallas cr\u00edticas)';
        var estadoColor = r.aprobado ? 'var(--success)' : 'var(--danger)';

        html += '<div class="detail-hdr">';
        html += '  <h2>INSPECCI\u00d3N DE SEGURIDAD INDUSTRIAL (FR-SST-003)</h2>';
        html += '</div>';

        html += '<div class="card">';
        html += '  <div class="card-title"><div class="icon">\ud83d\udccb</div>Resumen de Auditor\u00eda de Campo</div>';
        html += '  <div class="info-row"><span>Estado General Dictaminado:</span><strong style="color:' + estadoColor + '">' + estadoTexto + '</strong></div>';
        html += '  <div class="info-row"><span>Inspector Responsable:</span><strong>' + escHtml(r.inspector) + '</strong></div>';
        html += '  <div class="info-row"><span>Fecha de Emisi\u00f3n:</span><strong>' + escHtml(r.fecha) + '</strong></div>';
        html += '  <div class="info-row"><span>C\u00e9dula del Inspector:</span><strong>' + escHtml(r.cedula || '\u2014') + '</strong></div>';
        html += '  <div class="info-row"><span>Tel\u00e9fono de Contacto:</span><strong>' + escHtml(r.telefono || '\u2014') + '</strong></div>';
        html += '  <div class="info-row"><span>Sitio / Obra Evaluada:</span><strong>' + escHtml(r.sitio || 'No especificado') + '</strong></div>';
        html += '  <div class="info-row"><span>\u00bfCoordinador de TSA Validador?:</span><strong>' + (r.coordTSA ? 'S\u00cd (Validaci\u00f3n Completa)' : 'NO (Requiere Contra-firma)') + '</strong></div>';
        html += '  <div class="info-row"><span>Observaciones Registradas:</span><p style="font-size:13px;margin-top:2px;">' + escHtml(r.observaciones || 'Sin observaciones registradas.') + '</p></div>';
        html += '</div>';

        html += '<div class="card" style="page-break-inside:avoid;">';
        html += '  <div class="card-title"><div class="icon">\ud83d\udca1</div>Gu\u00eda T\u00e9cnica de Aceptaci\u00f3n y Reconocimiento</div>';
        html += '  <div class="notice-card-content">';
        html += '    <div class="notice-left">';
        html += '      <strong>Se entiende por "BUEN ESTADO GENERAL"</strong> a las siguientes condiciones condiciones observables durante la inspecci\u00f3n de los EPCC:';
        html += '      <ul style="list-style:none;margin-top:6px;">';
        html += '        <li style="margin-bottom:4px;">\ud83d\udd39 <strong>1. ETIQUETAS legibles y vigentes:</strong> Sin ellas el equipo se descarta autom\u00e1ticamente.</li>';
        html += '        <li style="margin-bottom:4px;">\ud83d\udd39 <strong>2. REATAS O CUERDAS:</strong> Ausencia de cortes, fibras rotas, quemaduras y/o da\u00f1o qu\u00edmico.</li>';
        html += '        <li style="margin-bottom:4px;">\ud83d\udd39 <strong>3. COSTURAS de seguridad:</strong> Que los hilos no est\u00e9n sueltos, rotos o desgastados.</li>';
        html += '        <li style="margin-bottom:4px;">\ud83d\udd39 <strong>4. HERRAJES (Argollas, Hebillas, Mosquetones):</strong> Sin deformaciones, fisuras, corrosi\u00f3n ni desgastes mec\u00e1nicos.</li>';
        html += '        <li style="margin-bottom:4px;">\ud83d\udd39 <strong>5. INDICADOR DE IMPACTO:</strong> Que el arn\u00e9s o las eslingas no se hayan activado por una ca\u00edda previa.</li>';
        html += '      </ul>';
        html += '    </div>';
        html += '    <div style="background:#fff;color:var(--text2);padding:12px;flex:1.2;font-size:11px;line-height:1.4;border-left:1px solid var(--gray3);display:flex;align-items:center;">';
        html += '      Este formato cumple legislaci\u00f3n colombiana Res 4272 de 2021 Arts 17 y 23 / Dec 1072 de 2015 Art\u00edculo 2.2.4.6.24 y ANSI - ASSE Z359 (Estados Unidos)';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';

        if (r.tecnicos && r.tecnicos.length > 0) {
            r.tecnicos.forEach(function (tec, tecIdx) {
                html += '<div class="card">';
                html += '  <div class="card-title"><div class="icon">\ud83d\udc64</div>T\u00e9cnico Evaluado #' + (tecIdx + 1) + '</div>';
                html += '  <div class="info-row"><span>Nombre</span><strong>' + escHtml(tec.nombre) + '</strong></div>';
                html += '  <div class="info-row"><span>C\u00e9dula</span><strong>' + escHtml(tec.cedula) + '</strong></div>';
                html += '  <div class="info-row"><span>Tel\u00e9fono</span><strong>' + escHtml(tec.telefono) + '</strong></div>';

                var equiposValidos = tec.equipos ? tec.equipos.filter(function (eq) { return !eq.noAplica; }) : [];
                if (equiposValidos.length > 0) {
                    html += '  <div style="margin-top:10px;">';
                    html += '    <span style="font-weight:bold;color:var(--navy);font-size:11px;text-transform:uppercase;letter-spacing:.02em;">Equipos Inspeccionados</span>';
                    equiposValidos.forEach(function (eq, eqIdx) {
                        html += '    <div style="background:var(--gray);padding:10px;border-radius:8px;margin-top:8px;font-size:12px;border:1px solid var(--gray2);">';
                        html += '      <div style="font-weight:bold;color:var(--navy2);margin-bottom:4px;">Equipo #' + (eqIdx + 1) + ' \u2014 ' + escHtml(eq.nombre || 'Sin nombre') + '</div>';
                        html += '      <div class="info-grid" style="margin-bottom:4px;">';
                        html += '        <div class="info-cell"><span>Marca:</span><strong>' + escHtml(eq.marca || '\u2014') + '</strong></div>';
                        html += '        <div class="info-cell"><span>Serial:</span><strong>' + escHtml(eq.serial || '\u2014') + '</strong></div>';
                        html += '        <div class="info-cell"><span>Lote:</span><strong>' + escHtml(eq.lote || '\u2014') + '</strong></div>';
                        html += '        <div class="info-cell"><span>F.Fabricaci\u00f3n:</span><strong>' + escHtml(eq.fecha || '\u2014') + '</strong></div>';
                        html += '      </div>';
                        if (eq.caracts) {
                            html += '      <div style="border:1px solid var(--gray3);border-radius:6px;padding:6px;background:white;">';
                            html += '        <span style="font-weight:bold;color:var(--navy);font-size:10px;text-transform:uppercase;display:block;margin-bottom:3px;">Certificaci\u00f3n General</span>';
                            Object.keys(eq.caracts).forEach(function (c) {
                                var v = eq.caracts[c];
                                var c2 = v === 'SI' ? 'var(--success)' : (v === 'NO' ? 'var(--danger)' : 'var(--text2)');
                                html += '        <div style="display:flex;justify-content:space-between;font-size:11px;border-bottom:1px solid var(--gray2);padding:2px 4px;">';
                                html += '          <span>' + c + '</span><span style="font-weight:bold;color:' + c2 + '">' + v + '</span></div>';
                            });
                            html += '      </div>';
                        }
                        html += '    </div>';
                    });
                    html += '  </div>';
                }

                var defectosTec = [];
                SECCIONES_MAL_EXCEL.forEach(function (g) {
                    g.items.forEach(function (item, ii) {
                        var dataKey = g.key + '_' + ii;
                        if (tec.malEstado && tec.malEstado[dataKey]) {
                            defectosTec.push(g.titulo.split(' ')[1] + ': ' + item);
                        }
                    });
                });

                if (defectosTec.length > 0) {
                    html += '  <div style="margin-top:10px;padding:8px;background:white;border-radius:6px;border-left:3px solid var(--danger);">';
                    html += '    <span style="font-weight:bold;color:var(--danger);display:block;margin-bottom:4px;font-size:11px;">Defectos Encontrados:</span>';
                    defectosTec.forEach(function (def) {
                        html += '    <div style="color:var(--danger);font-size:11px;margin-bottom:2px;">\u274c ' + def + '</div>';
                    });
                    html += '  </div>';
                } else if (equiposValidos.length > 0) {
                    html += '  <div style="color:var(--success);font-size:11px;margin-top:8px;font-weight:600;">\u2713 Sin novedades. Componentes estructurales aprobados.</div>';
                }

                if (tec.fotos && tec.fotos.length > 0) {
                    html += '  <div style="margin-top:10px;background:white;border-radius:6px;border:1px solid var(--gray3);padding:8px;">';
                    html += '    <span style="font-weight:bold;color:var(--navy);font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Soporte Fotogr\u00e1fico</span>';
                    html += '    <div class="photo-grid">';
                    tec.fotos.forEach(function (base64) {
                        html += '      <div style="width:100%;border:1px solid var(--gray3);border-radius:6px;overflow:hidden;background:#000;"><img src="' + base64 + '" style="width:100%;height:auto;display:block;cursor:zoom-in;" onclick="window.abrirHdLightbox(this.src)"></div>';
                    });
                    html += '    </div>';
                    html += '  </div>';
                }

                if (tec.firma) {
                    html += '  <div style="margin-top:10px;padding:8px;background:white;border-radius:6px;border:1px solid var(--gray3);">';
                    html += '    <span style="font-weight:bold;color:var(--navy);font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;">Firma del T\u00e9cnico</span>';
                    html += '    <img src="' + tec.firma + '" style="display:block;width:100%;max-width:260px;height:auto;background:#fafbfc;border:1px solid var(--gray3);border-radius:6px;">';
                    html += '  </div>';
                }

                html += '</div>';
            });
        } else if (r.equipos) {
            html += renderLegacyEquipos(r);
        }

        if (r.firma) {
            html += '<div class="card" style="page-break-inside:avoid;">';
            html += '  <div class="card-title"><div class="icon">\u2712\ufe0f</div>Firma de Validaci\u00f3n Digitalizada</div>';
            html += '  <img src="' + r.firma + '" style="display:block;width:100%;max-width:300px;height:auto;background:#fafbfc;border:1px solid var(--gray3);border-radius:6px;margin:0 auto;">';
            html += '</div>';
        }

        html += '<div class="card" style="page-break-inside:avoid;padding:0;overflow:hidden;border:1px solid var(--gray3);">';
        html += '  <table style="width:100%;border-collapse:collapse;text-align:center;font-size:11px;">';
        html += '    <thead><tr style="background:var(--gray);border-bottom:1px solid var(--gray3);">';
        html += '      <th style="padding:8px;font-weight:bold;color:var(--navy);border-right:1px solid var(--gray3);">Realizado por</th>';
        html += '      <th style="padding:8px;font-weight:bold;color:var(--navy);border-right:1px solid var(--gray3);">Aprobado por:</th>';
        html += '      <th style="padding:8px;font-weight:bold;color:var(--navy);border-right:1px solid var(--gray3);">Fecha de creaci\u00f3n:</th>';
        html += '      <th style="padding:8px;font-weight:bold;color:var(--navy);border-right:1px solid var(--gray3);">Fecha \u00faltima revisi\u00f3n:</th>';
        html += '    </tr></thead>';
        html += '    <tbody><tr>';
        html += '      <td style="padding:10px;color:var(--text);border-right:1px solid var(--gray3);">RH Gesti\u00f3n empresarial</td>';
        html += '      <td style="padding:10px;color:var(--text);border-right:1px solid var(--gray3);">Neyder Segrera</td>';
        html += '      <td style="padding:10px;color:var(--text);border-right:1px solid var(--gray3);">27/11/2018</td>';
        html += '      <td style="padding:10px;color:var(--text);">10/01/2023</td>';
        html += '    </tr></tbody>';
        html += '  </table>';
        html += '</div>';

        $('detalleContenido').innerHTML = html;
        $('btn-eliminar-reg').onclick = function () { eliminarReg(r.id); };

        var pd = $('screen-detalle');
        var oldBtn = pd.querySelector('.btn-pdf-dinamico');
        if (oldBtn) oldBtn.remove();

        var btnPdf = document.createElement('button');
        btnPdf.className = 'btn btn-pdf-dinamico';
        btnPdf.style = "background:var(--success);color:white;margin-top:15px;box-shadow:0 3px 10px rgba(56,161,105,.3);";
        btnPdf.innerHTML = '\ud83d\udce5 Exportar / Guardar Reporte en PDF';
        btnPdf.onclick = function () {
            var orig = document.title;
            var s = (r.sitio || 'Sin_Sitio').trim().replace(/[/\\?%*:|"<> ]/g, '_');
            document.title = "EPCC_" + s + "_" + r.fecha;
            window.print();
            setTimeout(function () { document.title = orig; }, 1000);
        };
        pd.insertBefore(btnPdf, $('btn-eliminar-reg'));

        var oldTelBtn = pd.querySelector('.btn-telegram');
        if (oldTelBtn) oldTelBtn.remove();
        var btnTel = document.createElement('button');
        btnTel.className = 'btn btn-telegram';
        btnTel.style = "background:#0088cc;color:white;margin-top:8px;box-shadow:0 3px 10px rgba(0,136,204,.3);";
        btnTel.innerHTML = '\u2709\ufe0f Enviar Reporte por Telegram';
        btnTel.onclick = function () { enviarTelegram(r.id); };
        pd.insertBefore(btnTel, $('btn-eliminar-reg'));

        showScreen('detalle');
    }

    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
        document.querySelectorAll('.nav-btn').forEach(function (b) {
            b.classList.remove('active');
            var bar = b.querySelector('.nav-bar');
            if (bar) bar.style.display = 'none';
        });
        $('screen-' + name).classList.add('active');
        var navBtn = $('nav-' + name);
        if (navBtn) {
            navBtn.classList.add('active');
            var bar = navBtn.querySelector('.nav-bar');
            if (bar) bar.style.display = 'block';
        }
        window.scrollTo(0, 0);
        if (name === 'historial') renderHistorial();
    }

    function showToast(msg, type) {
        var t = $('toast');
        if (!t) return;
        if (toastTimer) clearTimeout(toastTimer);
        t.textContent = msg;
        t.className = 'toast show' + (type ? ' toast--' + type : '');
        toastTimer = setTimeout(function () { t.className = 'toast'; }, 2500);
    }

    function abrirHdLightbox(sourceB64) {
        var overlay = $('customLightbox');
        var imgView = $('customLightboxImg');
        imgView.src = sourceB64;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function cerrarHdLightbox() {
        var overlay = $('customLightbox');
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    function renderHistorial() {
        var list = $('historial-lista');
        var regs = getRegs();
        var btnBorrar = $('btn-borrar-todo');
        if (regs.length === 0) {
            btnBorrar.style.display = 'none';
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83d\udcc1</div><p>No se registran inspecciones guardadas</p></div>';
            return;
        }
        btnBorrar.style.display = 'block';
        var html = '';
        regs.forEach(function (r) {
            var dotClass = r.aprobado ? 'dot-ok' : 'dot-warn';
            var totalEq = 0;
            if (r.tecnicos) {
                r.tecnicos.forEach(function (tec) {
                    totalEq += (tec.equipos || []).filter(function (eq) { return !eq.noAplica; }).length;
                });
            } else if (r.equipos) {
                totalEq = r.equipos.length;
            }
            var texto = totalEq === 1 ? '1 equipo' : totalEq + ' equipos';
            var ubi = r.sitio ? ' | ' + r.sitio : '';
            html += '<div class="record-item" onclick="window.verDetalle(\'' + r.id + '\')">';
            html += '  <div class="record-dot ' + dotClass + '"></div>';
            html += '  <div class="record-info">';
            html += '    <div class="record-name">' + escHtml(r.inspector) + ' (' + texto + ')' + '</div>';
            html += '    <div class="record-date">' + escHtml(r.fecha) + ubi + '</div>';
            html += '  </div>';
            html += '  <span style="font-size:12px;color:var(--text2)">\ud83d\udc41\ufe0f Ver / PDF</span>';
            html += '</div>';
        });
        list.innerHTML = html;
    }

    function eliminarReg(id) {
        if (!confirm('\u00bfSeguro que desea eliminar esta inspecci\u00f3n?')) return;
        var regs = getRegs().filter(function (r) { return r.id !== id; });
        localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(regs));
        showScreen('historial');
        showToast('\ud83d\uddd1\ufe0f Registro eliminado', 'info');
    }

    function borrarTodo() {
        if (!confirm('\ud83d\udea8 \u00bfEst\u00e1 seguro de vaciar el historial local permanentemente?')) return;
        localStorage.removeItem(CONFIG.HISTORY_KEY);
        renderHistorial();
        showToast('\ud83d\uddd1\ufe0f Base de datos local vaciada', 'info');
    }

    function updatePendingUI() {
        var p = JSON.parse(localStorage.getItem(CONFIG.PENDING_KEY) || '[]');
        var bar = $('pendingBar');
        var cnt = $('pendingCount');
        if (p.length === 0) { if (bar) bar.classList.add('hidden'); return; }
        if (bar) {
            bar.classList.remove('hidden');
            cnt.textContent = p.length + ' env\u00edo' + (p.length > 1 ? 's' : '') + ' pendiente' + (p.length > 1 ? 's' : '');
        }
    }

    function viewPending() {
        var list = $('pendingList');
        var p = JSON.parse(localStorage.getItem(CONFIG.PENDING_KEY) || '[]');
        if (list.classList.contains('hidden')) {
            var h = '';
            p.forEach(function (item, i) {
                var d = item.data || {};
                h += '<div class="pending-item">';
                h += '<span>' + (i + 1) + '. ' + escHtml(d.sitio || '\u2014') + ' | ' + (d.fecha || '\u2014') + '</span>';
                h += '<button class="btn-delete-pending" onclick="window._deletePending(' + i + ')" title="Eliminar">\u2715</button>';
                h += '</div>';
            });
            list.innerHTML = h;
            list.classList.remove('hidden');
        } else {
            list.classList.add('hidden');
        }
    }

    function deletePending(index) {
        var p = JSON.parse(localStorage.getItem(CONFIG.PENDING_KEY) || '[]');
        if (index < 0 || index >= p.length) return;
        p.splice(index, 1);
        if (p.length === 0) localStorage.removeItem(CONFIG.PENDING_KEY);
        else localStorage.setItem(CONFIG.PENDING_KEY, JSON.stringify(p));
        updatePendingUI();
        var list = $('pendingList');
        if (!list.classList.contains('hidden')) viewPending();
    }

    function descargarHistorial() {
        var regs = getRegs();
        if (regs.length === 0) { showToast('No hay historial para descargar', 'info'); return; }
        var json = JSON.stringify(regs, null, 2);
        var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'historial_epcc_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('\ud83d\udce5 Historial descargado \u2713', 'success');
    }

    function generarReporteHtml(r) {
        var h = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>EPCC - ' + escHtml(r.sitio) + ' - ' + r.fecha + '</title>';
        h += '<meta name="viewport" content="width=device-width,initial-scale=1">';
        h += '<style>';
        h += '*{box-sizing:border-box;margin:0;padding:0}';
        h += 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#1a2535;padding:20px;max-width:800px;margin:0 auto}';
        h += 'h1{font-size:18px;color:#0d2b4e;text-align:center;margin-bottom:4px;text-transform:uppercase}';
        h += 'h2{font-size:14px;color:#0d2b4e;margin-bottom:10px;border-bottom:2px solid #0d2b4e;padding-bottom:4px}';
        h += '.sub{text-align:center;font-size:11px;color:#4a5568;margin-bottom:20px}';
        h += '.sec{background:#f4f6f9;border-radius:8px;padding:12px;margin-bottom:14px;border:1px solid #c8d0dc}';
        h += '.sec-title{font-size:12px;font-weight:700;color:#0d2b4e;margin-bottom:8px;text-transform:uppercase}';
        h += '.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e8ecf1;font-size:12px}';
        h += '.row span{color:#4a5568;font-weight:600;font-size:11px}';
        h += '.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px}';
        h += '.grid div span{display:block;font-size:10px;color:#4a5568}';
        h += '.eq-box{background:#fff;border:1px solid #c8d0dc;border-radius:6px;padding:10px;margin-bottom:10px;font-size:12px}';
        h += '.eq-box .name{font-weight:700;color:#1a3f6f;margin-bottom:4px}';
        h += '.ok{color:#38a169;font-weight:700}';
        h += '.warn{color:#e53e3e;font-weight:700}';
        h += '.caracts{background:#fff;border:1px solid #e8ecf1;border-radius:6px;padding:6px;margin-top:6px;font-size:11px}';
        h += '.firma-img{display:block;max-width:260px;height:auto;background:#fafbfc;border:1px solid #c8d0dc;border-radius:6px;margin:6px 0}';
        h += '.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;margin-top:6px}';
        h += '.photo-grid img{width:100%;height:auto;border:1px solid #c8d0dc;border-radius:4px}';
        h += '.tag{background:#0d2b4e;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px}';
        h += '@media print{body{padding:0}.sec{break-inside:avoid}}';
        h += '</style></head><body>';

        h += '<h1>INSPECCI\u00d3N DE EQUIPOS DE PROTECCI\u00d3N CONTRA CA\u00cdDAS</h1>';
        h += '<div class="sub">SITOC &middot; Res. 4272/2021 / ANSI Z359 &middot; FR-SST-003 Ver. 05</div>';

        var estadoTexto = r.aprobado ? 'CONFORME (Buen estado global)' : 'NO CONFORME (Se detectaron fallas cr\u00edticas)';
        var estadoColor = r.aprobado ? '#38a169' : '#e53e3e';

        h += '<div class="sec">';
        h += '  <div class="sec-title">Resumen de Auditor\u00eda de Campo</div>';
        h += '  <div class="row"><span>Estado</span><strong style="color:' + estadoColor + '">' + estadoTexto + '</strong></div>';
        h += '  <div class="row"><span>Inspector</span><strong>' + escHtml(r.inspector) + '</strong></div>';
        h += '  <div class="row"><span>Fecha</span><strong>' + r.fecha + '</strong></div>';
        h += '  <div class="row"><span>C\u00e9dula</span><strong>' + escHtml(r.cedula || '\u2014') + '</strong></div>';
        h += '  <div class="row"><span>Tel\u00e9fono</span><strong>' + escHtml(r.telefono || '\u2014') + '</strong></div>';
        h += '  <div class="row"><span>Sitio</span><strong>' + escHtml(r.sitio || '\u2014') + '</strong></div>';
        h += '  <div class="row"><span>Coord. TSA</span><strong>' + (r.coordTSA ? 'S\u00cd' : 'NO') + '</strong></div>';
        if (r.observaciones) h += '  <div class="row"><span>Observaciones</span><strong>' + escHtml(r.observaciones) + '</strong></div>';
        h += '</div>';

        if (r.tecnicos) {
            r.tecnicos.forEach(function (tec, ti) {
                h += '<div class="sec">';
                h += '  <div class="sec-title">T\u00e9cnico #' + (ti + 1) + ': ' + escHtml(tec.nombre) + '</div>';
                h += '  <div class="row"><span>C\u00e9dula</span><strong>' + escHtml(tec.cedula) + '</strong></div>';
                h += '  <div class="row"><span>Tel\u00e9fono</span><strong>' + escHtml(tec.telefono) + '</strong></div>';

                var eqs = (tec.equipos || []).filter(function (e) { return !e.noAplica; });
                if (eqs.length > 0) {
                    h += '  <div style="margin-top:8px"><strong style="font-size:11px;color:#0d2b4e">Equipos</strong></div>';
                    eqs.forEach(function (eq, ei) {
                        h += '  <div class="eq-box">';
                        h += '    <div class="name">Eq #' + (ei + 1) + ' \u2014 ' + escHtml(eq.nombre || 'Sin nombre') + '</div>';
                        h += '    <div class="grid">';
                        h += '      <div><span>Marca</span>' + escHtml(eq.marca || '\u2014') + '</div>';
                        h += '      <div><span>Serial</span>' + escHtml(eq.serial || '\u2014') + '</div>';
                        h += '      <div><span>Lote</span>' + escHtml(eq.lote || '\u2014') + '</div>';
                        h += '      <div><span>F.Fab</span>' + escHtml(eq.fecha || '\u2014') + '</div>';
                        h += '    </div>';
                        if (eq.caracts) {
                            h += '    <div class="caracts">';
                            Object.keys(eq.caracts).forEach(function (c) {
                                var v = eq.caracts[c];
                                h += '    <div class="row"><span>' + c + '</span><strong class="' + (v === 'SI' ? 'ok' : 'warn') + '">' + v + '</strong></div>';
                            });
                            h += '    </div>';
                        }
                        h += '  </div>';
                    });
                }

                var defectos = [];
                SECCIONES_MAL_EXCEL.forEach(function (g) {
                    g.items.forEach(function (item, ii) {
                        if (tec.malEstado && tec.malEstado[g.key + '_' + ii]) {
                            defectos.push(g.titulo.split(' ')[1] + ': ' + item);
                        }
                    });
                });
                if (defectos.length > 0) {
                    h += '  <div style="margin-top:8px;padding:6px;background:#fff;border-left:3px solid #e53e3e;border-radius:4px;font-size:11px">';
                    h += '    <strong style="color:#e53e3e">Defectos:</strong>';
                    defectos.forEach(function (d) { h += '<div style="color:#e53e3e">\u274c ' + d + '</div>'; });
                    h += '  </div>';
                } else if (eqs.length > 0) {
                    h += '  <div style="margin-top:6px;font-size:12px;color:#38a169;font-weight:600">\u2713 Sin defectos</div>';
                }

                if (tec.fotos && tec.fotos.length > 0) {
                    h += '  <div style="margin-top:8px"><strong style="font-size:11px;color:#0d2b4e">Fotos</strong>';
                    h += '    <div class="photo-grid">';
                    tec.fotos.forEach(function (b64) {
                        h += '    <img src="' + b64 + '" alt="Foto">';
                    });
                    h += '    </div></div>';
                }

                if (tec.firma) {
                    h += '  <div style="margin-top:8px"><strong style="font-size:11px;color:#0d2b4e">Firma del T\u00e9cnico</strong>';
                    h += '  <img class="firma-img" src="' + tec.firma + '" alt="Firma"></div>';
                }

                h += '</div>';
            });
        }

        if (r.firma) {
            h += '<div class="sec">';
            h += '  <div class="sec-title">Firma del Inspector</div>';
            h += '  <img class="firma-img" src="' + r.firma + '" alt="Firma inspector">';
            h += '</div>';
        }

        h += '</body></html>';
        return h;
    }

    function enviarTelegram(id) {
        var r = getRegs().find(function (reg) { return reg.id === id; });
        if (!r) { showToast('Registro no encontrado', 'error'); return; }

        var totalTecnicos = r.tecnicos ? r.tecnicos.length : 0;
        var totalEquipos = 0;
        var equiposTexto = '';
        if (r.tecnicos) {
            r.tecnicos.forEach(function (tec, ti) {
                var eqValidos = (tec.equipos || []).filter(function (e) { return !e.noAplica; });
                totalEquipos += eqValidos.length;
                equiposTexto += '\n\ud83d\udc64 T\u00e9cnico #' + (ti + 1) + ': ' + tec.nombre + '\n';
                eqValidos.forEach(function (eq, ei) {
                    equiposTexto += '  \ud83d\udd27 Eq #' + (ei + 1) + ' ' + (eq.nombre || '') + '\n';
                    equiposTexto += '    Marca: ' + (eq.marca || '\u2014') + ' | Serial: ' + (eq.serial || '\u2014') + '\n';
                    if (eq.caracts) {
                        var todosSi = Object.keys(eq.caracts).every(function (k) { return eq.caracts[k] === 'SI'; });
                        equiposTexto += '    Certificaci\u00f3n: ' + (todosSi ? '\u2705 Conforme' : '\u26a0\ufe0f No conforme') + '\n';
                    }
                });
            });
        } else if (r.equipos) {
            totalEquipos = r.equipos.length;
            equiposTexto = '\n  (formato legacy, ' + totalEquipos + ' equipos)';
        }

        var estadoGlobal = r.aprobado ? '\u2705 CONFORME' : '\u26a0\ufe0f NO CONFORME';
        var msg = '\ud83d\udfe2 *INSPECCI\u00d3N EPCC - SITOC* \ud83d\udfe2\n';
        msg += '\ud83d\udcc5 Fecha: ' + r.fecha + '\n';
        msg += '\ud83d\udc64 Inspector: ' + r.inspector + '\n';
        msg += '\ud83c\udfe2 Sitio: ' + (r.sitio || '\u2014') + '\n';
        msg += '\ud83d\udccb Estado: ' + estadoGlobal + '\n';
        msg += '\ud83d\udc65 T\u00e9cnicos: ' + totalTecnicos + ' | Equipos: ' + totalEquipos + '\n';
        msg += equiposTexto;
        msg += '\n\n' + (r.observaciones ? '\ud83d\udcac Obs: ' + r.observaciones : '');

        var url = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage';

        showToast('\u2709\ufe0f Enviando reporte por Telegram...', 'info');

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: msg,
                parse_mode: 'Markdown'
            })
        }).then(function (res) { return res.json(); }).then(function (data) {
            if (data.ok) {
                showToast('\u2705 Reporte enviado por Telegram', 'success');
            } else {
                showToast('\u274c Error Telegram: ' + (data.description || 'desconocido'), 'error');
            }
        }).catch(function (err) {
            showToast('\u274c Error de red: ' + err.message, 'error');
        });
    }

    /* EXPOSE GLOBALS */
    window.setCoord = setCoord;
    window._setEqCaract = setEqCaract;
    window._toggleNoAplica = toggleNoAplica;
    window.agregarTecnico = agregarTecnico;
    window._agregarEq = agregarEquipo;
    window._eliminarTec = eliminarTecnico;
    window._eliminarEq = eliminarEquipo;
    window._capturarFotoTec = capturarFotoTecnico;
    window._limpiarFirmaTec = limpiarFirmaTecnico;
    window.abrirHdLightbox = abrirHdLightbox;
    window.cerrarHdLightbox = cerrarHdLightbox;
    window.limpiarFirma = limpiarFirma;
    window.guardarFormulario = guardarFormulario;
    window.showScreen = showScreen;
    window.verDetalle = verDetalle;
    window.eliminarReg = eliminarReg;
    window.borrarTodo = borrarTodo;
    window._deletePending = deletePending;
    window._viewPending = viewPending;
    window._descargarHistorial = descargarHistorial;
    window._enviarTelegram = enviarTelegram;

})();
