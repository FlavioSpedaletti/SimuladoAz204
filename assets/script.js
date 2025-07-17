class SimuladoApp {
    constructor() {
        this.data = null;
        this.selectedModules = [];
        this.totalQuestions = 60;
        this.examQuestions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.skippedQuestions = [];
        this.answeredCount = 0;
        this.isReviewingSkipped = false;
        this.currentSkippedIndex = 0;
        this.timeLeft = 0;
        this.timerInterval = null;
        this.currentState = 'config';
        this.chartViewMode = 'cards'; // Modo padrão de visualização
        this.isInterrupted = false;
        
        // Dados para análise com IA
        this.performanceData = {
            questionStartTime: null,
            questionTimes: [],
            answerPatterns: [],
            moduleDifficulties: {},
            totalExamTime: null,
            examStartTime: null
        };
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderModules();
        this.setupOfflineDetection();
    }

    async loadData() {
        try {
            const response = await fetch('./data/data.json');
            if (!response.ok) {
                throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
            }
            this.data = await response.json();
            console.log('Dados carregados com sucesso');
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            document.getElementById('modules-container').innerHTML = 
                `<div style="color: #e53e3e; background: #fff5f5; border: 1px solid #feb2b2; padding: 20px; border-radius: 8px;">
                    <h3>❌ Erro ao Carregar Dados</h3>
                    <p><strong>Não foi possível carregar o arquivo de questões.</strong></p>
                    <p>Certifique-se de que:</p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>O arquivo <code>data/data.json</code> existe</li>
                        <li>A aplicação está rodando em um servidor local</li>
                    </ul>
                    <p><strong>Como iniciar um servidor local:</strong></p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li><code>python -m http.server 8000</code></li>
                        <li><code>npx live-server</code></li>
                        <li><code>php -S localhost:8000</code></li>
                    </ul>
                </div>`;
        }
    }

    renderModules() {
        if (!this.data) return;

        const container = document.getElementById('modules-container');
        const modules = this.data.modulos;
        
        // Selecionar todos os módulos por padrão
        this.selectedModules = Object.keys(modules);
        
        let html = '<div class="module-selection">';
        
        Object.keys(modules).forEach(moduleKey => {
            const module = modules[moduleKey];
            const questionCount = Object.keys(module.perguntas).length;
            
            html += `
                <div class="module-item selected" data-module="${moduleKey}">
                    <label>
                        <input type="checkbox" class="module-checkbox" value="${moduleKey}" checked>
                        <strong>${module.nome}</strong><br>
                        <small>${module.descricao}</small><br>
                        <small style="color: #718096;">${questionCount} questões disponíveis</small>
                    </label>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Atualizar estado do botão de iniciar
        this.updateStartButtonState();
    }

    setupEventListeners() {
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('module-checkbox')) {
                this.handleModuleSelection(e);
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.name === 'alternative') {
                document.getElementById('next-btn').disabled = false;
                
                document.querySelectorAll('.alternative').forEach(alt => {
                    alt.classList.remove('selected');
                });
                e.target.closest('.alternative').classList.add('selected');
            }
        });

        document.getElementById('start-btn').addEventListener('click', () => this.startExam());
        document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('skip-btn').addEventListener('click', () => this.skipQuestion());
        
        // Botão de interrupção será configurado quando a tela do exame for mostrada

        document.getElementById('question-quantity').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value > 0) {
                this.totalQuestions = value;
            } else {
                this.totalQuestions = 0;
            }
            this.updateStartButtonState();
        });

        // Event listener para retry da análise IA
        document.addEventListener('click', (e) => {
            if (e.target.id === 'retry-ai-analysis') {
                this.generateAIAnalysis();
            }
        });

        // Event listener para o botão flutuante de análise IA
        document.addEventListener('click', (e) => {
            if (e.target.closest('#ai-analysis-fab')) {
                this.generateAIAnalysis();
            }
        });

        // Event listeners para seletor de visualização do gráfico
        document.addEventListener('click', (e) => {
            if (e.target.closest('.chart-view-btn')) {
                const btn = e.target.closest('.chart-view-btn');
                const viewMode = btn.dataset.view;
                this.setChartViewMode(viewMode);
            }
        });
    }

    updateStartButtonState() {
        const hasModules = this.selectedModules.length > 0;
        const hasValidQuantity = this.totalQuestions > 0;
        document.getElementById('start-btn').disabled = !hasModules || !hasValidQuantity;
    }

    setupInterruptButton() {
        const interruptBtn = document.getElementById('interrupt-btn');
        if (interruptBtn && !interruptBtn.hasAttribute('data-listener-added')) {
            interruptBtn.addEventListener('click', () => this.interruptExam());
            interruptBtn.setAttribute('data-listener-added', 'true');
        }
    }

    handleModuleSelection(e) {
        const moduleKey = e.target.value;
        const moduleItem = e.target.closest('.module-item');
        
        if (e.target.checked) {
            this.selectedModules.push(moduleKey);
            moduleItem.classList.add('selected');
        } else {
            this.selectedModules = this.selectedModules.filter(m => m !== moduleKey);
            moduleItem.classList.remove('selected');
        }

        this.updateStartButtonState();
    }

    startExam() {
        const questionQuantityInput = document.getElementById('question-quantity');
        const inputValue = parseInt(questionQuantityInput.value);
        
        if (isNaN(inputValue) || inputValue <= 0) {
            alert('Por favor, digite um número válido maior que zero para a quantidade de questões!');
            questionQuantityInput.focus();
            return;
        }
        
        this.totalQuestions = inputValue;
        
        if (this.selectedModules.length === 0) {
            alert('Selecione pelo menos um módulo para continuar!');
            return;
        }
        
        // Inicializar dados de performance
        this.performanceData.examStartTime = Date.now();
        this.performanceData.questionTimes = [];
        this.performanceData.answerPatterns = [];
        this.performanceData.moduleDifficulties = {};
        
        // Google Analytics: Rastrear início do simulado
        if (typeof gtag !== 'undefined') {
            gtag('event', 'simulado_iniciado', {
                'event_category': 'Simulado',
                'total_questoes': this.totalQuestions,
                'modulos_selecionados': this.selectedModules.length,
                'modulos': this.selectedModules.join(',')
            });
        }
        
        document.getElementById('intro-section').classList.add('hidden');
        document.body.classList.add('exam-mode');
        
        this.generateExamQuestions();
        this.timeLeft = this.examQuestions.length * 60;
        this.currentState = 'exam';
        this.showScreen('exam-screen');
        
        // Configurar event listener do botão de interrupção agora que a tela está visível
        this.setupInterruptButton();
        
        this.startTimer();
        this.renderCurrentQuestion();
    }

    generateExamQuestions() {
        this.examQuestions = [];
        // 1. Embaralhar as perguntas de cada módulo selecionado
        const moduleQuestions = this.selectedModules.map(moduleKey => {
            const module = this.data.modulos[moduleKey];
            const questions = Object.keys(module.perguntas);
            const shuffled = this.shuffleArray([...questions]);
            return {
                moduleKey,
                moduleName: module.nome,
                questions: shuffled,
                perguntas: module.perguntas
            };
        });

        let totalAdded = 0;
        let exhaustedModules = new Set();
        let moduleIndex = 0;
        // 2. Round-robin: enquanto não atingir o total desejado e ainda houver questões
        while (totalAdded < this.totalQuestions && exhaustedModules.size < moduleQuestions.length) {
            const mod = moduleQuestions[moduleIndex];
            if (mod.questions.length > 0) {
                const questionKey = mod.questions.shift();
                this.examQuestions.push({
                    moduleKey: mod.moduleKey,
                    moduleName: mod.moduleName,
                    questionKey,
                    question: mod.perguntas[questionKey]
                });
                totalAdded++;
                if (this.examQuestions.length >= this.totalQuestions) break;
                if (mod.questions.length === 0) {
                    exhaustedModules.add(moduleIndex);
                }
            } else {
                exhaustedModules.add(moduleIndex);
            }
            moduleIndex = (moduleIndex + 1) % moduleQuestions.length;
        }

        // Embaralhar a ordem final das questões
        this.examQuestions = this.shuffleArray(this.examQuestions);
        this.userAnswers = new Array(this.examQuestions.length).fill(null);
        this.skippedQuestions = [];
        this.answeredCount = 0;
        this.isReviewingSkipped = false;
        this.currentSkippedIndex = 0;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    renderCurrentQuestion() {
        if (this.currentQuestionIndex >= this.examQuestions.length) {
            if (this.skippedQuestions.length > 0 && !this.isReviewingSkipped) {
                this.startSkippedReview();
                return;
            }
            this.finishExam();
            return;
        }

        // Marcar tempo de início da questão
        this.performanceData.questionStartTime = Date.now();

        const examQuestion = this.examQuestions[this.currentQuestionIndex];
        const question = examQuestion.question;

        document.getElementById('question-number').textContent = 
            `Questão ${this.currentQuestionIndex + 1} de ${this.examQuestions.length}`;
        
        // Atualizar contador de puladas
        const skippedCounter = document.getElementById('skipped-counter');
        if (this.skippedQuestions.length > 0) {
            skippedCounter.textContent = `Puladas: ${this.skippedQuestions.length}`;
            skippedCounter.classList.remove('hidden');
        } else {
            skippedCounter.classList.add('hidden');
        }
        
        document.getElementById('module-name').textContent = examQuestion.moduleName;
        document.getElementById('question-text').innerHTML = question.descricao;

        const alternatives = Object.keys(question.alternativas).map(key => ({
            key,
            text: question.alternativas[key].descricao
        }));

        const shuffledAlternatives = this.shuffleArray([...alternatives]);

        let alternativesHtml = '';
        shuffledAlternatives.forEach(alt => {
            alternativesHtml += `
                <div class="alternative">
                    <input type="radio" name="alternative" value="${alt.key}" id="alt-${alt.key}">
                    <label for="alt-${alt.key}">${alt.text}</label>
                </div>
            `;
        });

        document.getElementById('alternatives-container').innerHTML = alternativesHtml;
        document.getElementById('next-btn').disabled = true;

        // Mostrar botão pular apenas se não estiver revisando questões puladas
        document.getElementById('skip-btn').style.display = this.isReviewingSkipped ? 'none' : 'inline-block';

        // Atualizar barra de progresso baseada em questões RESPONDIDAS
        const progress = (this.answeredCount / this.examQuestions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    nextQuestion() {
        if (this.isReviewingSkipped) {
            this.nextSkippedQuestion();
            return;
        }

        const selectedAnswer = document.querySelector('input[name="alternative"]:checked');
        if (selectedAnswer) {
            // Calcular tempo gasto na questão
            const questionTime = Date.now() - this.performanceData.questionStartTime;
            const examQuestion = this.examQuestions[this.currentQuestionIndex];
            
            // Armazenar dados de performance
            this.performanceData.questionTimes.push({
                questionIndex: this.currentQuestionIndex,
                moduleKey: examQuestion.moduleKey,
                time: questionTime,
                isCorrect: selectedAnswer.value === examQuestion.question.correta
            });

            this.userAnswers[this.currentQuestionIndex] = selectedAnswer.value;
            this.answeredCount++;
            this.currentQuestionIndex++;
            this.renderCurrentQuestion();
        }
    }

    skipQuestion() {
        if (this.isReviewingSkipped) return;
        
        // Registrar questão pulada para análise
        const questionTime = Date.now() - this.performanceData.questionStartTime;
        const examQuestion = this.examQuestions[this.currentQuestionIndex];
        
        this.performanceData.questionTimes.push({
            questionIndex: this.currentQuestionIndex,
            moduleKey: examQuestion.moduleKey,
            time: questionTime,
            isSkipped: true
        });

        this.skippedQuestions.push({
            index: this.currentQuestionIndex,
            originalIndex: this.currentQuestionIndex,
            examQuestion: this.examQuestions[this.currentQuestionIndex]
        });
        
        this.currentQuestionIndex++;
        this.renderCurrentQuestion();
    }

    interruptExam() {
        const answeredCount = this.userAnswers.filter(answer => answer !== null).length;
        
        if (answeredCount === 0) {
            alert('Você ainda não respondeu nenhuma questão. Continue o simulado ou volte à configuração.');
            return;
        }

        const confirmMessage = `Tem certeza que deseja interromper o simulado?

Você respondeu ${answeredCount} de ${this.examQuestions.length} questões.
O resultado será calculado apenas com base nas questões respondidas.

Esta ação não pode ser desfeita.`;

        if (confirm(confirmMessage)) {
            this.isInterrupted = true;
            this.finishExam(true);
        }
    }

    startSkippedReview() {
        if (this.skippedQuestions.length === 0) {
            this.finishExam();
            return;
        }

        this.isReviewingSkipped = true;
        this.currentSkippedIndex = 0;
        this.renderSkippedQuestion();
    }

    renderSkippedQuestion() {
        if (this.currentSkippedIndex >= this.skippedQuestions.length) {
            this.finishExam();
            return;
        }

        const skippedItem = this.skippedQuestions[this.currentSkippedIndex];
        const examQuestion = skippedItem.examQuestion;
        const question = examQuestion.question;

        document.getElementById('question-number').textContent = 
            `Revisão - Questão ${this.currentSkippedIndex + 1} de ${this.skippedQuestions.length}`;
        
        const skippedCounter = document.getElementById('skipped-counter');
        skippedCounter.textContent = `Puladas: ${this.skippedQuestions.length}`;
        skippedCounter.classList.remove('hidden');
        
        document.getElementById('module-name').textContent = examQuestion.moduleName;
        document.getElementById('question-text').innerHTML = question.descricao;

        const alternatives = Object.keys(question.alternativas).map(key => ({
            key,
            text: question.alternativas[key].descricao
        }));

        const shuffledAlternatives = this.shuffleArray([...alternatives]);

        let alternativesHtml = '';
        shuffledAlternatives.forEach(alt => {
            alternativesHtml += `
                <div class="alternative">
                    <input type="radio" name="alternative" value="${alt.key}" id="alt-${alt.key}">
                    <label for="alt-${alt.key}">${alt.text}</label>
                </div>
            `;
        });

        document.getElementById('alternatives-container').innerHTML = alternativesHtml;
        document.getElementById('next-btn').disabled = true;

        // Ocultar botão pular durante revisão
        document.getElementById('skip-btn').style.display = 'none';

        // Atualizar barra de progresso baseada em questões respondidas
        const progress = (this.answeredCount / this.examQuestions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    nextSkippedQuestion() {
        const selectedAnswer = document.querySelector('input[name="alternative"]:checked');
        if (selectedAnswer) {
            const skippedItem = this.skippedQuestions[this.currentSkippedIndex];
            this.userAnswers[skippedItem.originalIndex] = selectedAnswer.value;
            this.answeredCount++;
            
            this.skippedQuestions.splice(this.currentSkippedIndex, 1);
            
            this.renderSkippedQuestion();
        } else {
            this.currentSkippedIndex++;
            this.renderSkippedQuestion();
        }
    }

    startTimer() {
        document.getElementById('timer').classList.remove('hidden');
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.finishExam();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    finishExam(interrupted = false) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Se foi interrompido, marcar a propriedade
        if (interrupted) {
            this.isInterrupted = true;
        }
        
        // Calcular tempo total do exame
        this.performanceData.totalExamTime = Date.now() - this.performanceData.examStartTime;
        
        this.currentState = 'results';
        this.calculateResults();
        
        // Google Analytics: Rastrear conclusão do simulado
        if (typeof gtag !== 'undefined') {
            gtag('event', this.isInterrupted ? 'simulado_interrompido' : 'simulado_finalizado', {
                'event_category': 'Simulado',
                'pontuacao': this.results.percentage,
                'aprovado': this.results.passed,
                'total_questoes': this.results.total,
                'acertos': this.results.correct,
                'interrompido': this.isInterrupted
            });
        }
        
        this.showResults();
        this.showScreen('results-screen');
        
        // Mostrar botão flutuante de análise IA
        this.showAIFloatingButton();
    }

    calculateResults() {
        let correct = 0;
        let totalAnswered = 0;
        const moduleStats = {};

        this.examQuestions.forEach((examQuestion, index) => {
            const userAnswer = this.userAnswers[index];
            
            // Se foi interrompido, considerar apenas questões respondidas
            if (this.isInterrupted && userAnswer === null) {
                return; // Pular questões não respondidas
            }
            
            totalAnswered++;
            const correctAnswer = examQuestion.question.correta;
            const isCorrect = userAnswer === correctAnswer;
            
            if (isCorrect) correct++;

            if (!moduleStats[examQuestion.moduleKey]) {
                moduleStats[examQuestion.moduleKey] = {
                    name: examQuestion.moduleName,
                    correct: 0,
                    total: 0
                };
            }
            moduleStats[examQuestion.moduleKey].total++;
            if (isCorrect) moduleStats[examQuestion.moduleKey].correct++;
        });

        // Usar totalAnswered em vez de examQuestions.length quando interrompido
        const totalForCalculation = this.isInterrupted ? totalAnswered : this.examQuestions.length;

        this.results = {
            correct,
            total: totalForCalculation,
            totalAnswered,
            percentage: totalForCalculation > 0 ? Math.round((correct / totalForCalculation) * 100) : 0,
            passed: totalForCalculation > 0 ? (correct / totalForCalculation) >= 0.7 : false,
            moduleStats
        };
    }

    showResults() {
        document.body.classList.remove('exam-mode');
        
        const scoreElement = document.getElementById('final-score');
        scoreElement.textContent = `${this.results.percentage}%`;
        scoreElement.className = `score ${this.results.passed ? 'passed' : 'failed'}`;

        document.getElementById('pass-status').textContent = 
            this.results.passed ? 'APROVADO!' : 'REPROVADO';
        document.getElementById('pass-status').style.color = 
            this.results.passed ? '#38a169' : '#e53e3e';

        // Adicionar observação se foi interrompido
        if (this.isInterrupted) {
            const summaryElement = document.querySelector('.results-summary');
            const interruptedNotice = document.createElement('div');
            interruptedNotice.className = 'interrupted-notice';
            interruptedNotice.innerHTML = `
                <div style="background: #fef5e7; border: 1px solid #f6ad55; padding: 16px; border-radius: 8px; margin: 16px 0; color: #c05621;">
                    <strong>⚠️ Simulado Interrompido</strong><br>
                    Você interrompeu o simulado antes de responder todas as questões.<br>
                    Resultado baseado em ${this.results.totalAnswered} de ${this.examQuestions.length} questões respondidas.
                </div>
            `;
            summaryElement.appendChild(interruptedNotice);
        }

        // Carregar preferência de visualização
        this.loadChartViewPreference();
        
        this.renderChart();
        this.renderDetailedResults();
    }

    renderChart() {
        const chartContainer = document.getElementById('chart');
        
        switch (this.chartViewMode) {
            case 'minimal':
                this.renderChartMinimal(chartContainer);
                break;
            case 'table':
                this.renderChartTable(chartContainer);
                break;
            default:
                this.renderChartCards(chartContainer);
        }
    }

    renderChartCards(container) {
        let chartHtml = '<div class="chart-grid">';

        Object.keys(this.results.moduleStats).forEach(moduleKey => {
            const stats = this.results.moduleStats[moduleKey];
            const percentage = Math.round((stats.correct / stats.total) * 100);
            
            // Determinar cor baseada na performance (4 níveis)
            let performanceClass = 'good';
            if (percentage < 50) performanceClass = 'critical';        // Vermelho: <50%
            else if (percentage < 60) performanceClass = 'very-low';   // Laranja: 50-59%
            else if (percentage < 70) performanceClass = 'below-pass'; // Amarelo: 60-69%
            // Verde: ≥70% (padrão 'good')

            chartHtml += `
                <div class="chart-card ${performanceClass}">
                    <div class="chart-card-header">
                        <div class="chart-card-title">${stats.name}</div>
                        <div class="chart-card-percentage">${percentage}%</div>
                    </div>
                    <div class="chart-card-progress">
                        <div class="chart-card-bar" style="width: ${percentage}%"></div>
                    </div>
                    <div class="chart-card-stats">${stats.correct}/${stats.total} questões</div>
                </div>
            `;
        });

        chartHtml += '</div>';
        container.innerHTML = chartHtml;
    }

    renderChartMinimal(container) {
        let chartHtml = '<div class="chart-minimal">';

        Object.keys(this.results.moduleStats).forEach(moduleKey => {
            const stats = this.results.moduleStats[moduleKey];
            const percentage = Math.round((stats.correct / stats.total) * 100);
            
            // Determinar cor baseada na performance
            let performanceClass = 'good';
            if (percentage < 50) performanceClass = 'critical';
            else if (percentage < 60) performanceClass = 'very-low';
            else if (percentage < 70) performanceClass = 'below-pass';

            chartHtml += `
                <div class="chart-minimal-item">
                    <span class="minimal-name">${stats.name}:</span>
                    <span class="minimal-percentage ${performanceClass}">${percentage}%</span>
                </div>
            `;
        });

        chartHtml += '</div>';
        container.innerHTML = chartHtml;
    }

    renderChartTable(container) {
        let chartHtml = `
            <div class="chart-table">
                <div class="chart-table-header">
                    <div>Módulo</div>
                    <div>Acertos</div>
                    <div>Nota</div>
                    <div>Progresso</div>
                </div>
        `;

        Object.keys(this.results.moduleStats).forEach(moduleKey => {
            const stats = this.results.moduleStats[moduleKey];
            const percentage = Math.round((stats.correct / stats.total) * 100);
            
            // Determinar cor baseada na performance
            let performanceClass = 'good';
            if (percentage < 50) performanceClass = 'critical';
            else if (percentage < 60) performanceClass = 'very-low';
            else if (percentage < 70) performanceClass = 'below-pass';

            chartHtml += `
                <div class="chart-table-row">
                    <div class="table-module-name">${stats.name}</div>
                    <div class="table-stats">${stats.correct}/${stats.total}</div>
                    <div class="table-percentage ${performanceClass}">${percentage}%</div>
                    <div class="table-progress">
                        <div class="table-progress-bar">
                            <div class="table-progress-fill ${performanceClass}" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });

        chartHtml += '</div>';
        container.innerHTML = chartHtml;
    }

    renderDetailedResults() {
        const container = document.getElementById('questions-review');
        container.innerHTML = ''; // Limpar primeiro

        this.examQuestions.forEach((examQuestion, index) => {
            const userAnswer = this.userAnswers[index];
            
            // Se foi interrompido, pular questões não respondidas
            if (this.isInterrupted && userAnswer === null) {
                return;
            }
            
            const correctAnswer = examQuestion.question.correta;
            const isCorrect = userAnswer === correctAnswer;
            const question = examQuestion.question;

            const userAnswerText = userAnswer ? question.alternativas[userAnswer]?.descricao || 'Não respondida' : 'Não respondida';
            const correctAnswerText = question.alternativas[correctAnswer]?.descricao;

            // Criar elementos de forma programática para evitar problemas com template strings
            const questionDiv = document.createElement('div');
            questionDiv.className = `question-result ${isCorrect ? 'correct' : 'incorrect'}`;
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'question-result-header';
            
            const contentDiv = document.createElement('div');
            contentDiv.style.flex = '1';
            contentDiv.style.cursor = 'pointer';
            contentDiv.innerHTML = `
                <strong>Questão ${index + 1}</strong> - ${examQuestion.moduleName}
                <div style="font-size: 14px; margin-top: 5px;">${question.descricao}</div>
            `;
            contentDiv.onclick = function() {
                const body = this.closest('.question-result').querySelector('.question-result-body');
                body.classList.toggle('show');
            };
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'question-result-actions';
            
            // Criar botão de IA
            const aiButton = document.createElement('button');
            aiButton.className = 'question-ai-explain-btn';
            aiButton.innerHTML = '🤖';
            aiButton.title = 'Explicação detalhada com IA';
            aiButton.type = 'button';
            aiButton.onclick = (e) => {
                e.stopPropagation();
                this.explainQuestion(index);
            };
            
            // Criar status
            const statusDiv = document.createElement('div');
            statusDiv.className = 'question-status';
            statusDiv.style.fontWeight = 'bold';
            statusDiv.style.color = isCorrect ? '#38a169' : '#e53e3e';
            statusDiv.innerHTML = isCorrect ? '✓' : '✗';
            
            actionsDiv.appendChild(aiButton);
            actionsDiv.appendChild(statusDiv);
            
            headerDiv.appendChild(contentDiv);
            headerDiv.appendChild(actionsDiv);
            
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'question-result-body';
            bodyDiv.innerHTML = `
                ${isCorrect ? 
                    `<p><strong>Resposta:</strong> ${correctAnswerText}</p>` :
                    `<p><strong>Sua resposta:</strong> ${userAnswerText}</p>
                     <p><strong>Resposta correta:</strong> ${correctAnswerText}</p>`
                }
                <div class="explanation">
                    <strong>Explicação:</strong> ${question.explicacao}
                </div>
            `;
            
            questionDiv.appendChild(headerDiv);
            questionDiv.appendChild(bodyDiv);
            container.appendChild(questionDiv);
        });
    }

    showAIFloatingButton() {
        // Mostrar botão flutuante de análise IA
        document.getElementById('ai-analysis-fab').classList.remove('hidden');
        
        // Ocultar seção de análise IA inicialmente
        document.getElementById('ai-analysis-section').style.display = 'none';
    }

    hideAIFloatingButton() {
        // Ocultar botão flutuante após análise iniciada
        document.getElementById('ai-analysis-fab').classList.add('hidden');
        
        // Mostrar seção de análise IA
        document.getElementById('ai-analysis-section').style.display = 'block';
    }

    async generateAIAnalysis() {
        // Ocultar botão flutuante e mostrar seção de análise
        this.hideAIFloatingButton();
        
        // Mostrar loading
        document.getElementById('ai-loading').classList.remove('hidden');
        document.getElementById('ai-results').classList.add('hidden');
        document.getElementById('ai-error').classList.add('hidden');

        try {
            const analysisData = this.prepareAnalysisData();
            
            // Verificar se já temos uma API key salva
            let apiKey = this.getApiKey();
            if (!apiKey) {
                apiKey = await this.promptForAPIKey();
                // Se usuário optou por pular a análise IA
                if (!apiKey) {
                    this.showAISkipped();
                    return;
                }
                // Salvar para reutilizar em explicações de questões
                this.setApiKey(apiKey);
            }
            
            const aiResponse = await this.callGeminiAPI(analysisData, apiKey);
            this.displayAIResults(aiResponse);
        } catch (error) {
            console.error('Erro na análise IA:', error);
            this.showAIError();
        }
    }

    prepareAnalysisData() {
        // Calcular estatísticas detalhadas
        const modulePerformance = {};
        const avgTimePerQuestion = this.performanceData.questionTimes.reduce((sum, q) => sum + q.time, 0) / this.performanceData.questionTimes.length;
        
        // Agrupar por módulo
        this.performanceData.questionTimes.forEach(q => {
            if (!modulePerformance[q.moduleKey]) {
                modulePerformance[q.moduleKey] = {
                    correct: 0,
                    total: 0,
                    avgTime: 0,
                    totalTime: 0,
                    skipped: 0
                };
            }
            
            modulePerformance[q.moduleKey].total++;
            modulePerformance[q.moduleKey].totalTime += q.time;
            
            if (q.isSkipped) {
                modulePerformance[q.moduleKey].skipped++;
            } else if (q.isCorrect) {
                modulePerformance[q.moduleKey].correct++;
            }
        });

        // Calcular tempo médio por módulo
        Object.keys(modulePerformance).forEach(moduleKey => {
            const perf = modulePerformance[moduleKey];
            perf.avgTime = perf.totalTime / perf.total;
            perf.percentage = Math.round((perf.correct / perf.total) * 100);
        });

        return {
            overallScore: this.results.percentage,
            passed: this.results.passed,
            totalQuestions: this.results.total,
            correctAnswers: this.results.correct,
            totalExamTime: this.performanceData.totalExamTime,
            avgTimePerQuestion,
            modulePerformance,
            skippedTotal: this.skippedQuestions.length,
            moduleStats: this.results.moduleStats
        };
    }

    async callGeminiAPI(analysisData, apiKey, type = 'analysis') {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const prompt = type === 'question' ? 
            this.buildQuestionPrompt(analysisData) : 
            this.buildAnalysisPrompt(analysisData);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async promptForAPIKey() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    max-width: 500px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                ">
                    <h3 style="color: #2d3748; margin-bottom: 20px;">
                        🔑 Análise com IA
                    </h3>
                    <p style="color: #4a5568; margin-bottom: 20px; line-height: 1.5;">
                        Para receber análise personalizada com IA, insira sua chave da <strong>Google AI Studio</strong> (gratuita).
                    </p>
                    <div style="text-align: left; background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #2d3748; margin-bottom: 10px;">📋 Como obter sua chave gratuita:</h4>
                        <ol style="color: #4a5568; padding-left: 20px; line-height: 1.6;">
                            <li>Acesse: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: #3182ce;">aistudio.google.com/app/apikey</a></li>
                            <li>Faça login com sua conta Google</li>
                            <li>Clique em "Create API Key"</li>
                            <li>Copie a chave gerada</li>
                        </ol>
                    </div>
                    <input 
                        type="password" 
                        id="api-key-input" 
                        placeholder="Cole sua chave da API aqui"
                        style="
                            width: 100%;
                            padding: 12px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            margin-bottom: 15px;
                            font-size: 14px;
                            box-sizing: border-box;
                        "
                    >
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="use-api-key" style="
                            background: #3182ce;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                        ">Gerar Análise</button>
                        <button id="skip-api-key" style="
                            background: #718096;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                        ">Pular Análise</button>
                    </div>
                    <div style="background: #e6fffa; border: 1px solid #38d9a9; padding: 12px; border-radius: 8px; margin-top: 15px;">
                        <p style="color: #0d9488; font-size: 13px; margin: 0; font-weight: 600;">
                            🔒 Segurança: Sua chave não será salva permanentemente
                        </p>
                    </div>
                    <div style="background: #fef5e7; border: 1px solid #f6ad55; padding: 12px; border-radius: 8px; margin-top: 10px;">
                        <p style="color: #c05621; font-size: 12px; margin: 0; font-weight: 600;">
                            ⚠️ Aviso: Não compartilhe sua tela enquanto usar esta funcionalidade
                        </p>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const input = modal.querySelector('#api-key-input');
            const useBtn = modal.querySelector('#use-api-key');
            const skipBtn = modal.querySelector('#skip-api-key');
            
            useBtn.onclick = () => {
                const apiKey = input.value.trim();
                if (apiKey) {
                    document.body.removeChild(modal);
                    resolve(apiKey);
                } else {
                    alert('Por favor, insira uma chave válida');
                }
            };
            
            skipBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    useBtn.click();
                }
            };
            
            // Focar no input
            setTimeout(() => input.focus(), 100);
        });
    }

    buildAnalysisPrompt(data) {
        const moduleDetails = Object.keys(data.modulePerformance).map(moduleKey => {
            const perf = data.modulePerformance[moduleKey];
            const moduleName = this.data.modulos[moduleKey]?.nome || moduleKey;
            return `- ${moduleName}: ${perf.percentage}% de acertos (${perf.correct}/${perf.total} questões)`;
        }).join('\n');

        return `Você é um especialista em certificações Microsoft Azure, especificamente AZ-204 (Azure Developer Associate). Analise o desempenho abaixo de um candidato e forneça recomendações personalizadas em português brasileiro.

DADOS DO SIMULADO:
- Pontuação geral: ${data.overallScore}%
- Status: ${data.passed ? 'APROVADO (≥70%)' : 'REPROVADO (<70%)'}
- Questões corretas: ${data.correctAnswers}/${data.totalQuestions}
- Tempo total do exame: ${Math.round(data.totalExamTime / 60000)} minutos
- Tempo médio por questão: ${Math.round(data.avgTimePerQuestion / 1000)} segundos
- Questões puladas: ${data.skippedTotal}

DESEMPENHO POR MÓDULO:
${moduleDetails}

INSTRUÇÕES:
1. Identifique 2-3 pontos fortes principais
2. Identifique 2-3 pontos de melhoria prioritários
3. Forneça 3-4 recomendações específicas de estudo
4. Mantenha foco na certificação AZ-204
5. Use linguagem clara e motivadora
6. Priorize módulos com <70% de acertos

FORMATO DE RESPOSTA (use exatamente este formato):
**PONTOS FORTES:**
• [ponto forte 1]
• [ponto forte 2]

**PONTOS DE ATENÇÃO:**
• [área de melhoria 1] - [performance específica]
• [área de melhoria 2] - [performance específica]

**RECOMENDAÇÕES PRIORITÁRIAS:**
1. **[Tópico prioritário]** - [ação específica recomendada]
2. **[Tópico prioritário]** - [ação específica recomendada]
3. **[Tópico prioritário]** - [ação específica recomendada]

Mantenha cada item conciso (máximo 2 linhas) e específico para AZ-204.`;
    }

    buildQuestionPrompt(questionData) {
        return `Você é um especialista em certificações Microsoft Azure, especificamente AZ-204 (Azure Developer Associate). Forneça uma explicação detalhada e didática para a questão abaixo em português brasileiro.

DADOS DA QUESTÃO:
Módulo: ${questionData.module}
Questão: ${questionData.question}

ALTERNATIVAS:
${questionData.alternatives}

RESPOSTA DO CANDIDATO: ${questionData.userAnswer}
RESPOSTA CORRETA: ${questionData.correctAnswer}
STATUS: ${questionData.isCorrect ? 'ACERTOU' : 'ERROU'}

EXPLICAÇÃO ORIGINAL:
${questionData.originalExplanation}

INSTRUÇÕES:
1. Forneça uma explicação detalhada e didática
2. Explique por que a resposta correta está certa
3. Se o candidato errou, explique por que a resposta dele estava incorreta
4. Adicione contexto prático e exemplos de implementação
5. Mencione conceitos relacionados importantes para a certificação AZ-204
6. Use linguagem clara e técnica apropriada
7. Organize a explicação de forma estruturada

FORMATO DE RESPOSTA:
**CONCEITO PRINCIPAL:**
[Explicação do conceito central da questão]

**POR QUE A RESPOSTA CORRETA (${questionData.correctAnswer}) ESTÁ CERTA:**
[Explicação detalhada da resposta correta]

${!questionData.isCorrect ? `**POR QUE SUA RESPOSTA (${questionData.userAnswer}) ESTAVA INCORRETA:**
[Explicação do erro cometido]

` : ''}**CONTEXTO PRÁTICO:**
[Exemplos práticos e cenários de uso no Azure]

**DICAS PARA A CERTIFICAÇÃO:**
[Pontos importantes para lembrar no exame AZ-204]

Seja didático e completo na explicação, ajudando o candidato a compreender profundamente o conceito.`;
    }

    displayAIResults(aiResponse) {
        document.getElementById('ai-loading').classList.add('hidden');
        
        // Processar resposta da IA
        const sections = this.parseAIResponse(aiResponse);
        
        let html = '';
        
        if (sections.strengths && sections.strengths.length > 0) {
            html += `
                <div class="ai-section ai-strengths">
                    <h4>🎯 Pontos Fortes</h4>
                    <ul>
                        ${sections.strengths.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (sections.weaknesses && sections.weaknesses.length > 0) {
            html += `
                <div class="ai-section ai-weaknesses">
                    <h4>⚠️ Pontos de Atenção</h4>
                    <ul>
                        ${sections.weaknesses.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (sections.recommendations && sections.recommendations.length > 0) {
            html += `
                <div class="ai-section ai-recommendations">
                    <h4>📚 Recomendações Prioritárias</h4>
                    <ul>
                        ${sections.recommendations.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        document.getElementById('ai-results').innerHTML = html;
        document.getElementById('ai-results').classList.remove('hidden');

        // Google Analytics: Rastrear uso da análise IA
        if (typeof gtag !== 'undefined') {
            gtag('event', 'analise_ia_gerada', {
                'event_category': 'IA',
                'pontuacao': this.results.percentage,
                'aprovado': this.results.passed
            });
        }
    }

    parseMarkdown(text) {
        if (!text) return '';
        
        // Converter texto para HTML tratando marcadores Markdown
        let html = text;
        
        // Blocos de código (``` código ```) - processar primeiro para não interferir com outros marcadores
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Código inline (`código`)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Negrito (**texto**)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Itálico (*texto*)
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Títulos (### título)
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // Links [texto](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Citações (> texto)
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        
        // Separador horizontal (---)
        html = html.replace(/^---$/gm, '<hr>');
        
        // Listas (- item ou * item)
        const lines = html.split('\n');
        let inList = false;
        let processedLines = [];
        
        for (let line of lines) {
            const listMatch = line.match(/^[*-]\s+(.+)$/);
            if (listMatch) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push(`<li>${listMatch[1]}</li>`);
            } else {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push(line);
            }
        }
        
        if (inList) {
            processedLines.push('</ul>');
        }
        
        html = processedLines.join('\n');
        
        // Quebras de linha
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }

    parseAIResponse(response) {
        const sections = {
            strengths: [],
            weaknesses: [],
            recommendations: []
        };

        try {
            // Dividir por seções
            const strengthsMatch = response.match(/\*\*PONTOS FORTES:\*\*(.*?)(?=\*\*|$)/s);
            const weaknessesMatch = response.match(/\*\*PONTOS DE ATENÇÃO:\*\*(.*?)(?=\*\*|$)/s);
            const recommendationsMatch = response.match(/\*\*RECOMENDAÇÕES PRIORITÁRIAS:\*\*(.*?)(?=\*\*|$)/s);

            if (strengthsMatch) {
                sections.strengths = strengthsMatch[1]
                    .split('•')
                    .filter(item => item.trim())
                    .map(item => this.parseMarkdown(item.trim()));
            }

            if (weaknessesMatch) {
                sections.weaknesses = weaknessesMatch[1]
                    .split('•')
                    .filter(item => item.trim())
                    .map(item => this.parseMarkdown(item.trim()));
            }

            if (recommendationsMatch) {
                sections.recommendations = recommendationsMatch[1]
                    .split(/\d+\./)
                    .filter(item => item.trim())
                    .map(item => this.parseMarkdown(item.trim()));
            }
        } catch (error) {
            console.error('Erro ao processar resposta da IA:', error);
            // Fallback: mostrar resposta bruta se não conseguir parsear
            sections.recommendations = ['Resposta da IA não pôde ser processada corretamente.'];
        }

        return sections;
    }

    showAIError() {
        document.getElementById('ai-loading').classList.add('hidden');
        document.getElementById('ai-error').classList.remove('hidden');
    }

    showAISkipped() {
        document.getElementById('ai-loading').classList.add('hidden');
        document.getElementById('ai-results').classList.add('hidden');
        document.getElementById('ai-error').classList.add('hidden');
        
        // Mostrar novamente o botão flutuante se o usuário cancelou
        this.showAIFloatingButton();
    }

    showScreen(screenId) {
        document.querySelectorAll('.card').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    setChartViewMode(viewMode) {
        this.chartViewMode = viewMode;
        
        // Atualizar botões ativos
        document.querySelectorAll('.chart-view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewMode}"]`).classList.add('active');
        
        // Salvar preferência no localStorage
        localStorage.setItem('chart_view_mode', viewMode);
        
        // Re-renderizar gráfico se estamos na tela de resultados
        if (this.currentState === 'results' && this.results) {
            this.renderChart();
        }
    }

    loadChartViewPreference() {
        const savedMode = localStorage.getItem('chart_view_mode');
        if (savedMode && ['cards', 'minimal', 'table'].includes(savedMode)) {
            this.setChartViewMode(savedMode);
        }
    }

    async explainQuestion(questionIndex) {
        const examQuestion = this.examQuestions[questionIndex];
        const question = examQuestion.question;
        const userAnswer = this.userAnswers[questionIndex];
        const correctAnswer = question.correta;
        const isCorrect = userAnswer === correctAnswer;

        // Criar modal de explicação
        const modal = this.createExplanationModal(questionIndex + 1);
        document.body.appendChild(modal);

        try {
            // Mostrar loading
            this.showQuestionExplanationLoading(modal);

            // Verificar se já temos uma API key salva temporariamente
            let apiKey = this.getApiKey();
            if (!apiKey) {
                apiKey = await this.promptForAPIKey();
                if (!apiKey) {
                    document.body.removeChild(modal);
                    return;
                }
                // Salvar temporariamente para outras explicações na mesma sessão
                this.setApiKey(apiKey);
            }

            // Preparar dados da questão
            const questionData = this.prepareQuestionData(examQuestion, question, userAnswer, isCorrect);
            
            // Chamar Gemini API
            const aiResponse = await this.callGeminiAPI(questionData, apiKey, 'question');
            
            // Mostrar resultado
            this.displayQuestionExplanation(modal, aiResponse, questionIndex + 1);

            // Google Analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'explicacao_questao_ia', {
                    'event_category': 'IA',
                    'questao_numero': questionIndex + 1,
                    'acertou': isCorrect
                });
            }

        } catch (error) {
            console.error('Erro na explicação da questão:', error);
            this.showQuestionExplanationError(modal, questionIndex + 1);
        }
    }

    createExplanationModal(questionNumber) {
        const modal = document.createElement('div');
        modal.className = 'question-explanation-modal';
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        
        modal.innerHTML = `
            <div class="question-explanation-content">
                <div class="question-explanation-header">
                    <h3>🤖 Explicação Detalhada - Questão ${questionNumber}</h3>
                    <button class="close-modal-btn" onclick="document.body.removeChild(this.closest('.question-explanation-modal'))">✕</button>
                </div>
                <div class="question-explanation-body">
                    <div class="question-explanation-loading">
                        <div class="ai-spinner"></div>
                        <p>Gerando explicação detalhada com IA...</p>
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    showQuestionExplanationLoading(modal) {
        const body = modal.querySelector('.question-explanation-body');
        body.innerHTML = `
            <div class="question-explanation-loading">
                <div class="ai-spinner"></div>
                <p>Gerando explicação detalhada com IA...</p>
            </div>
        `;
    }

    displayQuestionExplanation(modal, aiResponse, questionNumber) {
        const body = modal.querySelector('.question-explanation-body');
        body.innerHTML = `
            <div class="question-explanation-result">
                <div class="ai-explanation-content">
                    ${this.parseMarkdown(aiResponse)}
                </div>
            </div>
        `;
    }

    showQuestionExplanationError(modal, questionNumber) {
        const body = modal.querySelector('.question-explanation-body');
        body.innerHTML = `
            <div class="question-explanation-error">
                <div class="ai-error-icon">⚠️</div>
                <h4>Erro na Explicação</h4>
                <p>Não foi possível gerar a explicação para esta questão. Tente novamente.</p>
                <button id="retry-question-btn" class="btn btn-secondary">Tentar Novamente</button>
            </div>
        `;
        
        // Adicionar event listener programaticamente (mais seguro)
        const retryBtn = body.querySelector('#retry-question-btn');
        retryBtn.onclick = () => this.explainQuestion(questionNumber - 1);
    }

    prepareQuestionData(examQuestion, question, userAnswer, isCorrect) {
        // Montar texto com enunciado e alternativas
        const alternativesText = Object.keys(question.alternativas)
            .map(key => `${key.replace('alternativa', '').toUpperCase()}) ${question.alternativas[key].descricao}`)
            .join('\n');

        const userAnswerLetter = userAnswer ? userAnswer.replace('alternativa', '').toUpperCase() : 'Não respondida';
        const correctAnswerLetter = question.correta.replace('alternativa', '').toUpperCase();

        return {
            module: examQuestion.moduleName,
            question: question.descricao,
            alternatives: alternativesText,
            userAnswer: userAnswerLetter,
            correctAnswer: correctAnswerLetter,
            isCorrect,
            originalExplanation: question.explicacao
        };
    }

    // Métodos de proteção da chave API
    setApiKey(key) {
        // Ofuscação básica - não é criptografia real, apenas dificulta acesso casual
        this._k = btoa(key).split('').reverse().join('');
    }
    
    getApiKey() {
        if (!this._k) return null;
        try {
            return atob(this._k.split('').reverse().join(''));
        } catch {
            return null;
        }
    }
    
    clearApiKey() {
        delete this._k;
    }

    setupOfflineDetection() {
        const offlineIndicator = document.getElementById('offline-indicator');
        const onlineIndicator = document.getElementById('online-indicator');
        let isInitialLoad = true;

        const showOfflineIndicator = () => {
            offlineIndicator.classList.add('show');
            onlineIndicator.classList.remove('show');
            
            setTimeout(() => {
                if (!navigator.onLine) {
                    offlineIndicator.classList.remove('show');
                }
            }, 5000);
        };

        const showOnlineIndicator = () => {
            if (!isInitialLoad) {
                onlineIndicator.classList.add('show');
                offlineIndicator.classList.remove('show');
                
                setTimeout(() => {
                    onlineIndicator.classList.remove('show');
                }, 3000);
            }
            isInitialLoad = false;
        };

        const updateConnectionStatus = () => {
            if (navigator.onLine) {
                showOnlineIndicator();
            } else {
                showOfflineIndicator();
            }
        };

        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);

        if (!navigator.onLine) {
            showOfflineIndicator();
        }
    }
}

// Encapsular para evitar acesso global direto
(function() {
    let app;
    
    document.addEventListener('DOMContentLoaded', () => {
        app = new SimuladoApp();
        
        // Não precisamos expor nada globalmente agora!
        // Todos os event listeners são adicionados programaticamente
    });
})();
