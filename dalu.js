// Sistema de dados melhorado com persistência local
        let appointments = [];
        let appointmentIdCounter = 1;
        let isAdminLoggedIn = false;

        // Configurações
        const ADMIN_PASSWORD = 'admin123'; // Troque por uma senha segura
        const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
        const STORAGE_KEY = 'nail_studio_appointments';
        const COUNTER_KEY = 'nail_studio_counter';

        // Mapeamento de serviços
        const SERVICE_NAMES = {
            'blindagem': '💎 Blindagem das Unhas',
            'gel': '✨ Unhas em Gel',
            'plastica': '🦶 Plástica dos Pés',
            'pedicure': '💅 Pedicure Tradicional',
            'manicure': '👐 Manicure Tradicional',
            'decoracao': '🎨 Decoração de Unha',
            'combo_completo': '🎉 Combo Completo (Mãos + Pés)'
        };

        // Sistema de sincronização entre abas
        let syncInterval;

        // Inicialização
        document.addEventListener('DOMContentLoaded', function() {
            // Carregar dados salvos
            loadStoredData();
            
            // Configurar data mínima como hoje
            const today = new Date().toISOString().split('T')[0];
            document.querySelector('input[name="date"]').setAttribute('min', today);

            // Carregar dados de exemplo se for primeira vez
            if (appointments.length === 0) {
                loadSampleData();
            }
            
            // Configurar event listeners
            setupEventListeners();
            
            // Iniciar sincronização entre abas
            startSync();
        });

        // Funções de persistência de dados
        function saveData() {
            try {
                // Converter datas para strings antes de salvar
                const dataToSave = appointments.map(apt => ({
                    ...apt,
                    createdAt: apt.createdAt.toISOString()
                }));
                
                // Usar sessionStorage em vez de localStorage para simular servidor
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
                sessionStorage.setItem(COUNTER_KEY, appointmentIdCounter.toString());
                
                // Disparar evento personalizado para sincronizar abas
                window.dispatchEvent(new CustomEvent('appointmentsUpdated'));
            } catch (error) {
                console.warn('Não foi possível salvar os dados:', error);
            }
        }

        function loadStoredData() {
            try {
                const stored = sessionStorage.getItem(STORAGE_KEY);
                const storedCounter = sessionStorage.getItem(COUNTER_KEY);
                
                if (stored) {
                    const parsedData = JSON.parse(stored);
                    appointments = parsedData.map(apt => ({
                        ...apt,
                        createdAt: new Date(apt.createdAt)
                    }));
                }
                
                if (storedCounter) {
                    appointmentIdCounter = parseInt(storedCounter, 10);
                }
            } catch (error) {
                console.warn('Não foi possível carregar os dados:', error);
                appointments = [];
                appointmentIdCounter = 1;
            }
        }

        function startSync() {
            // Escutar mudanças de outras abas
            window.addEventListener('storage', function(e) {
                if (e.key === STORAGE_KEY) {
                    loadStoredData();
                    // Recarregar horários se estiver na tela de agendamento
                    const dateInput = document.querySelector('input[name="date"]');
                    if (dateInput && dateInput.value) {
                        loadAvailableTimes();
                    }
                    // Atualizar admin se estiver logado
                    if (isAdminLoggedIn) {
                        updateAdminStats();
                        renderAppointmentsList();
                    }
                }
            });

            // Escutar evento customizado para mudanças na mesma aba
            window.addEventListener('appointmentsUpdated', function() {
                const dateInput = document.querySelector('input[name="date"]');
                if (dateInput && dateInput.value) {
                    loadAvailableTimes();
                }
                if (isAdminLoggedIn) {
                    updateAdminStats();
                    renderAppointmentsList();
                }
            });

            // Verificar mudanças periodicamente (fallback)
            syncInterval = setInterval(() => {
                const currentData = sessionStorage.getItem(STORAGE_KEY);
                const currentStoredData = JSON.stringify(appointments.map(apt => ({
                    ...apt,
                    createdAt: apt.createdAt.toISOString()
                })));
                
                if (currentData !== currentStoredData) {
                    loadStoredData();
                    window.dispatchEvent(new CustomEvent('appointmentsUpdated'));
                }
            }, 2000); // Verificar a cada 2 segundos
        }

        function loadSampleData() {
            // Não adicionar dados de exemplo para manter sistema limpo
            // Os dados serão criados conforme os agendamentos forem feitos
        }

        function setupEventListeners() {
            // Controle dos checkboxes e cálculo do total
            const checkboxes = document.querySelectorAll('input[name="services"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const item = this.closest('.checkbox-item');
                    if (this.checked) {
                        item.classList.add('checked');
                    } else {
                        item.classList.remove('checked');
                    }

                    // Verificar se combo completo foi selecionado
                    if (this.value === 'combo_completo' && this.checked) {
                        checkboxes.forEach(cb => {
                            if (cb.value !== 'combo_completo') {
                                cb.checked = false;
                                cb.closest('.checkbox-item').classList.remove('checked');
                            }
                        });
                    } else if (this.checked && this.value !== 'combo_completo') {
                        const comboCheckbox = document.querySelector('input[value="combo_completo"]');
                        comboCheckbox.checked = false;
                        comboCheckbox.closest('.checkbox-item').classList.remove('checked');
                    }

                    updateTotal();
                });
            });

            // Formatação do telefone
            document.querySelector('input[name="phone"]').addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                value = value.replace(/(\d)(\d{4})$/, '$1-$2');
                e.target.value = value;
            });

            // Formatação do telefone de busca
            document.getElementById('searchPhone').addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                value = value.replace(/(\d)(\d{4})$/, '$1-$2');
                e.target.value = value;
            });

            // Envio do formulário
            document.getElementById('appointmentForm').addEventListener('submit', handleFormSubmit);
        }

        function updateTotal() {
            const checkboxes = document.querySelectorAll('input[name="services"]');
            let total = 0;
            let hasSelected = false;

            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    total += parseFloat(checkbox.dataset.price);
                    hasSelected = true;
                }
            });

            const totalSection = document.getElementById('totalSection');
            const totalValue = document.getElementById('totalValue');

            if (hasSelected) {
                totalSection.style.display = 'block';
                totalValue.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
            } else {
                totalSection.style.display = 'none';
            }
        }

        function showSection(section) {
            // Atualizar container para admin
            const container = document.getElementById('mainContainer');
            if (section === 'admin') {
                container.classList.add('admin-container');
            } else {
                container.classList.remove('admin-container');
            }

            // Atualizar botões de navegação
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // Mostrar seção correspondente
            document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
            
            if (section === 'booking') {
                document.getElementById('bookingSection').classList.add('active');
            } else if (section === 'manage') {
                document.getElementById('manageSection').classList.add('active');
            } else if (section === 'admin') {
                document.getElementById('adminSection').classList.add('active');
                if (isAdminLoggedIn) {
                    showAdminDashboard();
                } else {
                    showAdminLogin();
                }
            }
        }

        function loadAvailableTimes() {
            const selectedDate = document.querySelector('input[name="date"]').value;
            const timeSlotsContainer = document.getElementById('timeSlots');
            
            if (!selectedDate) {
                timeSlotsContainer.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">Selecione uma data para ver os horários disponíveis</p>';
                return;
            }

            // Recarregar dados mais recentes antes de verificar disponibilidade
            loadStoredData();

            // Verificar quais horários estão ocupados na data selecionada
            const occupiedTimes = appointments
                .filter(apt => apt.date === selectedDate && apt.status !== 'cancelled')
                .map(apt => apt.time);

            // Gerar slots de horário
            const slotsHtml = TIME_SLOTS.map(time => {
                const isOccupied = occupiedTimes.includes(time);
                const slotClass = isOccupied ? 'time-slot unavailable' : 'time-slot';
                const onclick = isOccupied ? '' : `onclick="selectTime('${time}')"`;
                const status = isOccupied ? ' - ❌ Ocupado' : ' - ✅ Disponível';
                
                return `<span class="${slotClass}" ${onclick}>${time}${status}</span>`;
            }).join('');

            timeSlotsContainer.innerHTML = slotsHtml;
        }

        function selectTime(time) {
            // Verificar novamente se o horário ainda está disponível (dupla verificação)
            loadStoredData();
            const selectedDate = document.querySelector('input[name="date"]').value;
            const isStillAvailable = !appointments.some(apt => 
                apt.date === selectedDate && 
                apt.time === time && 
                apt.status !== 'cancelled'
            );

            if (!isStillAvailable) {
                showError('Este horário acabou de ser ocupado. Recarregando horários disponíveis...');
                loadAvailableTimes();
                return;
            }

            // Remover seleção anterior
            document.querySelectorAll('.time-slot').forEach(slot => {
                slot.classList.remove('selected');
            });

            // Selecionar novo horário
            event.target.classList.add('selected');
            document.getElementById('selectedTime').value = time;
        }

        function handleFormSubmit(e) {
            e.preventDefault();

            const formData = new FormData(e.target);
            const submitBtn = document.querySelector('.submit-btn');
            const btnText = document.getElementById('btnText');

            // Validações
            const selectedServices = Array.from(document.querySelectorAll('input[name="services"]:checked'));
            const selectedTime = document.getElementById('selectedTime').value;

            if (selectedServices.length === 0) {
                showError('Por favor, selecione pelo menos um serviço!');
                return;
            }

            if (!selectedTime) {
                showError('Por favor, selecione um horário!');
                return;
            }

            // Mostrar loading
            submitBtn.disabled = true;
            btnText.innerHTML = '<div class="loading"></div> Verificando disponibilidade...';

            // Verificação final de disponibilidade (crítica para evitar conflitos)
            setTimeout(() => {
                // Recarregar dados mais recentes
                loadStoredData();
                
                const selectedDate = formData.get('date');
                const isTimeAvailable = !appointments.some(apt => 
                    apt.date === selectedDate && 
                    apt.time === selectedTime && 
                    apt.status !== 'cancelled'
                );

                if (!isTimeAvailable) {
                    showError('⚠️ Este horário acabou de ser ocupado por outro cliente. Por favor, escolha outro horário.');
                    loadAvailableTimes(); // Recarregar horários
                    
                    // Resetar botão
                    submitBtn.disabled = false;
                    btnText.textContent = 'Confirmar Agendamento';
                    return;
                }

                // Processar agendamento se horário ainda estiver disponível
                btnText.innerHTML = '<div class="loading"></div> Processando agendamento...';
                
                setTimeout(() => {
                    const services = selectedServices.map(cb => cb.value);
                    const serviceNames = selectedServices.map(cb => {
                        return cb.closest('.checkbox-item').querySelector('.service-name').textContent;
                    });

                    const total = selectedServices.reduce((sum, cb) => {
                        return sum + parseFloat(cb.dataset.price);
                    }, 0);

                    const newAppointment = {
                        id: appointmentIdCounter++,
                        name: formData.get('name'),
                        phone: formData.get('phone'),
                        date: selectedDate,
                        time: selectedTime,
                        services: services,
                        serviceNames: serviceNames,
                        total: total,
                        notes: formData.get('notes') || '',
                        status: 'pending',
                        createdAt: new Date()
                    };

                    // Adicionar agendamento E salvar imediatamente
                    appointments.push(newAppointment);
                    saveData(); // CRÍTICO: Salvar imediatamente para outras abas verem

                    // Resetar formulário
                    e.target.reset();
                    document.querySelectorAll('.checkbox-item').forEach(item => {
                        item.classList.remove('checked');
                    });
                    document.getElementById('totalSection').style.display = 'none';
                    document.getElementById('timeSlots').innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">Selecione uma data para ver os horários disponíveis</p>';
                    document.getElementById('selectedTime').value = '';

                    // Mostrar sucesso
                    document.getElementById('successMessage').classList.add('show');
                    setTimeout(() => {
                        document.getElementById('successMessage').classList.remove('show');
                    }, 5000);

                    // Resetar botão
                    submitBtn.disabled = false;
                    btnText.textContent = 'Confirmar Agendamento';
                }, 1000);
            }, 500); // Pequeno delay para simular verificação no servidor
        }

        function showError(message) {
            const errorMessage = document.getElementById('errorMessage');
            const errorText = document.getElementById('errorText');
            
            errorText.textContent = message;
            errorMessage.classList.add('show');
            
            setTimeout(() => {
                errorMessage.classList.remove('show');
            }, 5000);
        }

        // Funções de busca de agendamentos do cliente
        function searchClientAppointments() {
            const phone = document.getElementById('searchPhone').value.trim();
            if (!phone) {
                alert('Por favor, digite seu telefone.');
                return;
            }
            
            // Recarregar dados antes da busca
            loadStoredData();
            
            // Normalizar telefone para busca
            const normalizedPhone = phone.replace(/\D/g, '');
            const clientAppointments = appointments.filter(apt => {
                const aptPhone = apt.phone.replace(/\D/g, '');
                return aptPhone === normalizedPhone;
            });
            
            const container = document.getElementById('clientAppointmentsContainer');
            const appointmentsList = document.getElementById('clientAppointmentsList');
            
            if (clientAppointments.length === 0) {
                appointmentsList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">Nenhum agendamento encontrado para este telefone.</p>';
            } else {
                appointmentsList.innerHTML = clientAppointments.map(appointment => {
                    const isPast = new Date(appointment.date + 'T' + appointment.time) < new Date();
                    const canCancel = appointment.status !== 'cancelled' && !isPast && appointment.status !== 'completed';
                    const formattedDate = new Date(appointment.date).toLocaleDateString('pt-BR');
                    
                    return `
                        <div class="appointment-card">
                            <div class="appointment-header">
                                <div class="appointment-date">${formattedDate} às ${appointment.time}</div>
                                <div class="appointment-status status-${appointment.status}">
                                    ${appointment.status === 'pending' ? 'Aguardando Confirmação' : 
                                      appointment.status === 'confirmed' ? 'Confirmado' : 
                                      appointment.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                </div>
                            </div>
                            <div class="appointment-info">
                                <div><strong>👤 Nome:</strong> ${appointment.name}</div>
                                <div><strong>✨ Serviços:</strong> ${appointment.serviceNames.join(', ')}</div>
                                <div><strong>💰 Total:</strong> R$ ${appointment.total.toFixed(2).replace('.', ',')}</div>
                                <div><strong>📝 Agendado em:</strong> ${appointment.createdAt.toLocaleString('pt-BR')}</div>
                                ${appointment.notes ? `<div><strong>💬 Observações:</strong> ${appointment.notes}</div>` : ''}
                                ${isPast ? '<div><em style="color: #666;">⏰ Agendamento já realizado</em></div>' : ''}
                            </div>
                            ${canCancel ? `
                                <div class="appointment-actions">
                                    <button class="btn-small btn-cancel" onclick="clientCancelAppointment(${appointment.id})">
                                        ❌ Cancelar Agendamento
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            }
            
            container.style.display = 'block';
        }

        function clientCancelAppointment(id) {
            if (confirm('Tem certeza que deseja cancelar este agendamento?')) {
                loadStoredData(); // Recarregar dados
                const appointment = appointments.find(apt => apt.id === id);
                if (appointment) {
                    appointment.status = 'cancelled';
                    saveData(); // Salvar mudança
                    searchClientAppointments(); // Recarregar lista
                    alert('Agendamento cancelado com sucesso!');
                }
            }
        }

        // Funções do Admin Panel
        function adminLogin() {
            const password = document.getElementById('adminPassword').value;
            
            if (password === ADMIN_PASSWORD) {
                isAdminLoggedIn = true;
                showAdminDashboard();
            } else {
                alert('Senha incorreta!');
                document.getElementById('adminPassword').value = '';
            }
        }

        function adminLogout() {
            isAdminLoggedIn = false;
            showAdminLogin();
        }

        function showAdminLogin() {
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminDashboard').style.display = 'none';
            document.getElementById('adminPassword').value = '';
        }

        function showAdminDashboard() {
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            loadStoredData(); // Recarregar dados
            updateAdminStats();
            renderAppointmentsList();
        }

        function updateAdminStats() {
            const today = new Date().toISOString().split('T')[0];
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            // Estatísticas básicas
            const totalAppointments = appointments.length;
            const todayAppointments = appointments.filter(apt => apt.date === today).length;
            const pendingAppointments = appointments.filter(apt => apt.status === 'pending').length;
            
            // Agendamentos do mês atual
            const monthlyAppointments = appointments.filter(apt => {
                const aptDate = new Date(apt.date);
                return aptDate.getMonth() === currentMonth && aptDate.getFullYear() === currentYear;
            });

            // Calcular receitas por status
            const confirmedRevenue = monthlyAppointments
                .filter(apt => apt.status === 'confirmed' || apt.status === 'completed')
                .reduce((sum, apt) => sum + apt.total, 0);
                
            const pendingRevenue = monthlyAppointments
                .filter(apt => apt.status === 'pending')
                .reduce((sum, apt) => sum + apt.total, 0);
                
            const cancelledRevenue = monthlyAppointments
                .filter(apt => apt.status === 'cancelled')
                .reduce((sum, apt) => sum + apt.total, 0);

            const monthlyRevenue = confirmedRevenue + pendingRevenue;
            const completedServices = monthlyAppointments.filter(apt => apt.status === 'completed').length;

            // Atualizar DOM
            document.getElementById('totalAppointments').textContent = totalAppointments;
            document.getElementById('todayAppointments').textContent = todayAppointments;
            document.getElementById('pendingAppointments').textContent = pendingAppointments;
            document.getElementById('monthlyRevenue').textContent = `R$ ${monthlyRevenue.toFixed(0)}`;
            document.getElementById('completedServices').textContent = completedServices;
            
            document.getElementById('confirmedRevenue').textContent = `R$ ${confirmedRevenue.toFixed(2).replace('.', ',')}`;
            document.getElementById('pendingRevenue').textContent = `R$ ${pendingRevenue.toFixed(2).replace('.', ',')}`;
            document.getElementById('cancelledRevenue').textContent = `R$ ${cancelledRevenue.toFixed(2).replace('.', ',')}`;
        }

        function renderAppointmentsList() {
            const container = document.getElementById('appointmentsContainer');
            
            if (appointments.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 40px;">Nenhum agendamento encontrado</p>';
                return;
            }

            // Ordenar por data e horário
            const sortedAppointments = [...appointments].sort((a, b) => {
                const dateA = new Date(`${a.date} ${a.time}`);
                const dateB = new Date(`${b.date} ${b.time}`);
                return dateB - dateA; // Mais recentes primeiro
            });

            const appointmentsHtml = sortedAppointments.map(apt => {
                const formattedDate = new Date(apt.date).toLocaleDateString('pt-BR');
                const statusClass = `status-${apt.status}`;
                const statusText = {
                    'pending': 'Pendente',
                    'confirmed': 'Confirmado',
                    'completed': 'Concluído',
                    'cancelled': 'Cancelado'
                }[apt.status];

                return `
                    <div class="appointment-card">
                        <div class="appointment-header">
                            <div class="appointment-date">${formattedDate} às ${apt.time}</div>
                            <div class="appointment-status ${statusClass}">${statusText}</div>
                        </div>
                        
                        <div class="appointment-info">
                            <div><strong>👤 Cliente:</strong> ${apt.name}</div>
                            <div><strong>📱 WhatsApp:</strong> ${apt.phone}</div>
                            <div><strong>✨ Serviços:</strong> ${apt.serviceNames.join(', ')}</div>
                            <div><strong>💰 Total:</strong> R$ ${apt.total.toFixed(2).replace('.', ',')}</div>
                            <div><strong>📝 Agendado em:</strong> ${apt.createdAt.toLocaleString('pt-BR')}</div>
                            ${apt.notes ? `<div><strong>💬 Observações:</strong> ${apt.notes}</div>` : ''}
                        </div>

                        <div class="appointment-actions">
                            ${apt.status === 'pending' ? `
                                <button class="btn-small btn-confirm" onclick="updateAppointmentStatus(${apt.id}, 'confirmed')">
                                    ✅ Confirmar
                                </button>
                            ` : ''}
                            
                            ${apt.status === 'confirmed' ? `
                                <button class="btn-small btn-complete" onclick="updateAppointmentStatus(${apt.id}, 'completed')">
                                    ✨ Concluir
                                </button>
                            ` : ''}
                            
                            ${apt.status !== 'cancelled' && apt.status !== 'completed' ? `
                                <button class="btn-small btn-cancel" onclick="updateAppointmentStatus(${apt.id}, 'cancelled')">
                                    ❌ Cancelar
                                </button>
                            ` : ''}
                            
                            <button class="btn-small" style="background: #25d366; color: white;" onclick="contactClient('${apt.phone}', '${apt.name}', '${apt.serviceNames.join(', ')}', '${formattedDate}', '${apt.time}')">
                                💬 WhatsApp
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = appointmentsHtml;
        }

        function updateAppointmentStatus(appointmentId, newStatus) {
            loadStoredData(); // Recarregar dados
            const appointment = appointments.find(apt => apt.id === appointmentId);
            if (appointment) {
                appointment.status = newStatus;
                saveData(); // Salvar mudança
                updateAdminStats();
                renderAppointmentsList();
                
                // Mostrar notificação
                const statusMessages = {
                    'confirmed': 'Agendamento confirmado!',
                    'completed': 'Agendamento concluído!',
                    'cancelled': 'Agendamento cancelado!'
                };
                
                const message = statusMessages[newStatus];
                if (message) {
                    // Criar notificação temporária
                    const notification = document.createElement('div');
                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #28a745;
                        color: white;
                        padding: 15px 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        z-index: 1000;
                        animation: slideIn 0.3s ease;
                    `;
                    notification.textContent = message;
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                        notification.remove();
                    }, 3000);
                }
            }
        }

        function contactClient(phone, name, services, date, time) {
            const message = `Olá ${name}! 😊\n\nEste é um contato sobre seu agendamento:\n\n✨ *Serviços:* ${services}\n📅 *Data:* ${date}\n⏰ *Horário:* ${time}\n\nQualquer dúvida, estou à disposição! 💅`;
            const cleanPhone = phone.replace(/\D/g, '');
            let formattedPhone = cleanPhone;
            
            // Adicionar código do país se necessário
            if (cleanPhone.length === 11 && cleanPhone.startsWith('11')) {
                formattedPhone = '55' + cleanPhone;
            } else if (cleanPhone.length === 10) {
                formattedPhone = '5511' + cleanPhone;
            } else if (!cleanPhone.startsWith('55')) {
                formattedPhone = '55' + cleanPhone;
            }
            
            const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }

        // Adicionar eventos de teclado para o admin
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && document.getElementById('adminPassword') === document.activeElement) {
                adminLogin();
            }
        });

        // Limpeza quando a página for fechada
        window.addEventListener('beforeunload', function() {
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        });
