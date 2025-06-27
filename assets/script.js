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

        document.getElementById('question-quantity').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value > 0) {
                this.totalQuestions = value;
                this.updateStartButtonState();
            } else {
                e.target.value = 1;
                this.totalQuestions = 1;
                this.updateStartButtonState();
            }
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
    }

    updateStartButtonState() {
        const hasModules = this.selectedModules.length > 0;
        const hasValidQuantity = this.totalQuestions > 0;
        document.getElementById('start-btn').disabled = !hasModules || !hasValidQuantity;
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
        if (this.totalQuestions <= 0) {
            alert('O número de questões deve ser maior que zero!');
            return;
        }
        
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
        this.startTimer();
        this.renderCurrentQuestion();
    }

    generateExamQuestions() {
        this.examQuestions = [];
        const questionsPerModule = Math.floor(this.totalQuestions / this.selectedModules.length);
        const extraQuestions = this.totalQuestions % this.selectedModules.length;

        this.selectedModules.forEach((moduleKey, index) => {
            const module = this.data.modulos[moduleKey];
            const questions = Object.keys(module.perguntas);
            
            let questionsToTake = questionsPerModule;
            if (index < extraQuestions) {
                questionsToTake += 1;
            }

            const shuffledQuestions = this.shuffleArray([...questions]);
            const selectedQuestions = shuffledQuestions.slice(0, Math.min(questionsToTake, questions.length));

            selectedQuestions.forEach(questionKey => {
                this.examQuestions.push({
                    moduleKey,
                    moduleName: module.nome,
                    questionKey,
                    question: module.perguntas[questionKey]
                });
            });
        });

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

    finishExam() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Calcular tempo total do exame
        this.performanceData.totalExamTime = Date.now() - this.performanceData.examStartTime;
        
        this.currentState = 'results';
        this.calculateResults();
        
        // Google Analytics: Rastrear conclusão do simulado
        if (typeof gtag !== 'undefined') {
            gtag('event', 'simulado_finalizado', {
                'event_category': 'Simulado',
                'pontuacao': this.results.percentage,
                'aprovado': this.results.passed,
                'total_questoes': this.results.total,
                'acertos': this.results.correct
            });
        }
        
        this.showResults();
        this.showScreen('results-screen');
        
        // Mostrar botão flutuante de análise IA
        this.showAIFloatingButton();
    }

    calculateResults() {
        let correct = 0;
        const moduleStats = {};

        this.examQuestions.forEach((examQuestion, index) => {
            const userAnswer = this.userAnswers[index];
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

        this.results = {
            correct,
            total: this.examQuestions.length,
            percentage: Math.round((correct / this.examQuestions.length) * 100),
            passed: (correct / this.examQuestions.length) >= 0.7,
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

        this.renderChart();
        this.renderDetailedResults();
    }

    renderChart() {
        const chartContainer = document.getElementById('chart');
        let chartHtml = '';

        Object.keys(this.results.moduleStats).forEach(moduleKey => {
            const stats = this.results.moduleStats[moduleKey];
            const percentage = Math.round((stats.correct / stats.total) * 100);
            const barHeight = Math.max(30, (percentage / 100) * 200);

            chartHtml += `
                <div class="chart-bar">
                    <div class="bar-value">${percentage}%</div>
                    <div class="bar" style="height: ${barHeight}px;"></div>
                    <div class="bar-label">${stats.name}</div>
                    <div style="font-size: 11px; color: #718096;">${stats.correct}/${stats.total}</div>
                </div>
            `;
        });

        chartContainer.innerHTML = chartHtml;
    }

    renderDetailedResults() {
        const container = document.getElementById('questions-review');
        let html = '';

        this.examQuestions.forEach((examQuestion, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswer = examQuestion.question.correta;
            const isCorrect = userAnswer === correctAnswer;
            const question = examQuestion.question;

            const userAnswerText = userAnswer ? question.alternativas[userAnswer]?.descricao || 'Não respondida' : 'Não respondida';
            const correctAnswerText = question.alternativas[correctAnswer]?.descricao;

            html += `
                <div class="question-result ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="question-result-header" onclick="this.parentElement.querySelector('.question-result-body').classList.toggle('show')">
                        <div>
                            <strong>Questão ${index + 1}</strong> - ${examQuestion.moduleName}
                            <div style="font-size: 14px; margin-top: 5px;">${question.descricao}</div>
                        </div>
                        <div style="font-weight: bold; color: ${isCorrect ? '#38a169' : '#e53e3e'};">
                            ${isCorrect ? '✓' : '✗'}
                        </div>
                    </div>
                    <div class="question-result-body">
                        ${isCorrect ? 
                            `<p><strong>Resposta:</strong> ${correctAnswerText}</p>` :
                            `<p><strong>Sua resposta:</strong> ${userAnswerText}</p>
                             <p><strong>Resposta correta:</strong> ${correctAnswerText}</p>`
                        }
                        <div class="explanation">
                            <strong>Explicação:</strong> ${question.explicacao}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
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
            const apiKey = await this.promptForAPIKey();
            
            // Se usuário optou por pular a análise IA
            if (!apiKey) {
                this.showAISkipped();
                return;
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

    async callGeminiAPI(analysisData, apiKey) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const prompt = this.buildAnalysisPrompt(analysisData);

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
                            🔒 Segurança: Sua chave não será salva e será usada apenas para esta análise
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
                    .map(item => item.trim());
            }

            if (weaknessesMatch) {
                sections.weaknesses = weaknessesMatch[1]
                    .split('•')
                    .filter(item => item.trim())
                    .map(item => item.trim());
            }

            if (recommendationsMatch) {
                sections.recommendations = recommendationsMatch[1]
                    .split(/\d+\./)
                    .filter(item => item.trim())
                    .map(item => item.trim());
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
}

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new SimuladoApp();
});
