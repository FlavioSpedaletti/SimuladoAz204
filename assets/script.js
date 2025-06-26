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
        this.timeLeft = 0;
        this.timerInterval = null;
        this.currentState = 'config';
        
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
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
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

        const currentQuestion = this.examQuestions[this.currentQuestionIndex];
        const question = currentQuestion.question;

        document.getElementById('question-number').textContent = 
            `Questão ${this.currentQuestionIndex + 1} de ${this.examQuestions.length}`;
        
        const skippedCounter = document.getElementById('skipped-counter');
        if (this.skippedQuestions.length > 0) {
            skippedCounter.textContent = `Puladas: ${this.skippedQuestions.length}`;
            skippedCounter.classList.remove('hidden');
        } else {
            skippedCounter.classList.add('hidden');
        }

        document.getElementById('module-name').textContent = currentQuestion.moduleName;
        document.getElementById('question-text').textContent = question.descricao;

        const alternatives = Object.keys(question.alternativas).map(key => ({
            key,
            text: question.alternativas[key].descricao
        }));
        const shuffledAlternatives = this.shuffleArray(alternatives);

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

        // Mostrar botão pular
        document.getElementById('skip-btn').style.display = 'inline-block';

        // Atualizar barra de progresso baseada em perguntas respondidas
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
            this.userAnswers[this.currentQuestionIndex] = selectedAnswer.value;
            this.answeredCount++;
        }

        this.currentQuestionIndex++;
        this.renderCurrentQuestion();
    }

    skipQuestion() {
        if (!this.isReviewingSkipped) {
            this.skippedQuestions.push({
                originalIndex: this.currentQuestionIndex,
                question: this.examQuestions[this.currentQuestionIndex]
            });
        }

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
        const currentQuestion = skippedItem.question;
        const question = currentQuestion.question;

        document.getElementById('question-number').textContent = 
            `Revisão - Questão ${this.currentSkippedIndex + 1} de ${this.skippedQuestions.length}`;
        
        const skippedCounter = document.getElementById('skipped-counter');
        if (this.skippedQuestions.length > 0) {
            skippedCounter.textContent = `Puladas: ${this.skippedQuestions.length}`;
            skippedCounter.classList.remove('hidden');
        } else {
            skippedCounter.classList.add('hidden');
        }

        document.getElementById('module-name').textContent = currentQuestion.moduleName;
        document.getElementById('question-text').textContent = question.descricao;

        const alternatives = Object.keys(question.alternativas).map(key => ({
            key,
            text: question.alternativas[key].descricao
        }));
        const shuffledAlternatives = this.shuffleArray(alternatives);

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

        document.getElementById('skip-btn').style.display = 'none';

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
        
        this.currentState = 'results';
        this.calculateResults();
        this.showResults();
        this.showScreen('results-screen');
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
