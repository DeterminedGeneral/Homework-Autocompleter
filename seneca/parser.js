class DynamicSessionGenerator {
    constructor(questionsData) {
        if (!questionsData || !questionsData.contents?.length) {
            throw new Error("Invalid questionsData format.");
        }
        this.questionsData = questionsData;
        this.allModules = questionsData.contents.flatMap(c => c.contentModules);
        this.viewOnly = ['concept', 'video', 'image-description', 'delve'];
    }

    _transformImageUrl(input) {
        if (!input) return { url: null, fallbackUrl: null };
        if (typeof input === 'object' && input.url) return input;

        const url = input;
        if (url.startsWith('seneca-image-cdn:///')) {
            const baseUrl = 'https://image-v2.cdn.app.senecalearning.com/';
            const path = url.replace('seneca-image-cdn:///', '');
            if (path.includes('.jpg') && !path.includes(',')) {
                return { url: `${baseUrl}${path.replace('.jpg', '')},f_cover,h_400,w_600.jpg`, fallbackUrl: null };
            }
            return { url: baseUrl + path, fallbackUrl: null };
        }
        return { url: url, fallbackUrl: null };
    }

    _selectModules() {
        const studyModules = this.allModules.filter(m => this.viewOnly.includes(m.moduleType));
        const testedModules = this.allModules.filter(m => !this.viewOnly.includes(m.moduleType));

        // Desired sequence: Study, Test, Test, Study, Test
        const pattern = ["study", "test", "test", "study", "test"];

        const selectedModules = [];
        let sIndex = 0;
        let tIndex = 0;

        for (const type of pattern) {
            if (type === "study") {
                if (studyModules[sIndex]) selectedModules.push(studyModules[sIndex++]);
            } else {
                if (testedModules[tIndex]) selectedModules.push(testedModules[tIndex++]);
            }
        }

        return selectedModules;
    }


    _transformModule(module) {
        const { moduleType, content } = module;
        let contentMod = {};
        let extraFields = {};
        const isTested = !this.viewOnly.includes(moduleType);

        switch (moduleType) {
            case 'concept':
                contentMod = {
                    ...content,
                    examples: content.examples?.map(ex => ({
                        title: ex.title,
                        example: ex.example,
                        image: this._transformImageUrl(ex.url || ex.image)
                    }))
                };
                break;

            case 'wordfill':
                // DYNAMIC LOGIC: Assume any object with a .word property is testable.
                const answerWords = {};
                contentMod = {
                    words: content.words.map(item => {
                        if (item && typeof item === 'object' && item.word) {
                            answerWords[item.word] = item.word; // Prepare the correct answer
                            return { ...item, testing: true }; // Mark as testable
                        }
                        return item;
                    }),
                    renderImage: !!content.imageURL,
                };
                if(content.imageURL) {
                    contentMod.imageURL = this._transformImageUrl(content.imageURL).url;
                }

                extraFields = {
                    userAnswer: { words: answerWords },
                    moduleScore: {
                        words: Object.fromEntries(Object.keys(answerWords).map(key => [key, true])),
                        score: 1,
                        inputScores: Object.keys(answerWords).map(() => true)
                    }
                };
                break;

            case 'toggles':
                // DYNAMIC LOGIC: Build the output structure and determine correct answers on the fly.
                const correctAnswers = []; // This will store the correct index (0 or 1) for each toggle.
                
                contentMod = {
                    statement: content.statement,
                    toggles: content.toggles.map(toggle => {
                        // For each toggle, randomly decide if the correct answer is index 0 or 1.
                        const correctIdx = Math.round(Math.random());
                        correctAnswers.push(correctIdx);

                        return {
                            index0: correctIdx === 0 ? toggle.correctToggle : toggle.incorrectToggle,
                            index1: correctIdx === 1 ? toggle.correctToggle : toggle.incorrectToggle,
                            correctAnswer: correctIdx // This key is CREATED here.
                        };
                    }),
                    initialAnswer: content.toggles.map(() => 0) // Default initial state
                };

                extraFields = {
                    userAnswer: correctAnswers, // Provide the array of correct answers we just generated.
                    moduleScore: {
                        score: 1,
                        inputScores: correctAnswers.map(() => true)
                    }
                };
                break;
            case 'flashcard':
                contentMod = {
                    "examQuestion": content.examQuestion,
                    "question": content.question,
                    "answer": content.answer,
                    "connections": content.connections,
                    "imageURL": this._transformImageUrl(content.imageURL).url
                };

                extraFields = {
                    "userAnswer": {
                        "flipped": true,
                        "difficulty": "EASY"
                    },
                    "score": 1,
                    "moduleScore": {
                        "score": 1,
                        "inputScores": []
                    }
                };
                break;
            case 'multiple-choice':
                const possibleAnswers = [...content.wrongAnswers, content.correctAnswer];
                const correctAnswerIndex = possibleAnswers.length - 1;
                contentMod = {
                    question: content.question,
                    answers: possibleAnswers,
                    correctAnswerIndex
                };

                extraFields = {
                    userAnswer: {
                        index: correctAnswerIndex
                    }, // Provide the array of correct answers we just generated.
                    moduleScore: {
                        score: 1,
                        inputScores: [true]
                    }
                };
                break;
            case 'image-description':
                contentMod = {
                    title: content.title,
                    words: content.words,
                    imageURL: content.imageURL,
                    image: this._transformImageUrl(content.imageURL),
                    renderImage: false
                };
                extraFields = {
                    userAnswer: {
                        words: {}
                    }
                };
                break;
            default:
                contentMod = content;
                break;
        }

        return {
            gaveUp: false,
            submitted: isTested,
            completed: true,
            testingActive: isTested,
            moduleType,
            content: contentMod,
            score: isTested ? 1 : 0,
            ...extraFields
        };
    }

    generate({ userId, sessionId, durations }) {
        const selectedModules = this._selectModules();
        let currentTime = new Date();
        const generatedModules = [];

        for (const [index, module] of selectedModules.entries()) {
            const transformedPart = this._transformModule(module);
            
            const timeStarted = new Date(currentTime);
            // --- Use provided duration instead of random ---
            const durationSeconds = durations[index];

            // Advance time by that duration
            currentTime.setSeconds(currentTime.getSeconds() + durationSeconds);
            const timeFinished = new Date(currentTime);
            
            generatedModules.push({
                sessionId,
                moduleOrder: index,
                moduleId: module.id,
                timeStarted: timeStarted.toISOString().replace('.000Z', '+00:00'),
                timeFinished: timeFinished.toISOString().replace('.000Z', '+00:00'),
                ...transformedPart,
                courseId: module.courseId,
                sectionId: this.questionsData.id,
                contentId: module.parentId,
            });
        }
        
        const testedModules = generatedModules.filter(m => m.testingActive);
        
        return {
            platform: "seneca",
            clientVersion: "4.0.380",
            userId,
            session: {
                sessionId,
                courseId: this.questionsData.contents[0].courseId,
                timeStarted: generatedModules[0]?.timeStarted,
                timeFinished: generatedModules[generatedModules.length - 1]?.timeFinished.replace('+00:00', 'Z'),
                startingProficiency: 0,
                endingProficiency: 1,
                startingCourseProficiency: 0.027954904033095414,
                endingCourseProficiency: 0.1153582554517134,
                endingCourseScore: 0.17987295414033375,
                // --- Calculated session stats ---
                sessionScore: 1,
                completed: true,
                modulesCorrect: testedModules.length,
                modulesIncorrect: 0,
                averageScore: 1,
                modulesGaveUp: 0,
                modulesStudied: generatedModules.length,
                modulesTested: testedModules.length,
                sessionType: "adaptive",
                sectionIds: [this.questionsData.id],
                contentIds: [],
                options: { hasHardestQuestionContent: false }
            },
            modules: generatedModules,
        };
    }
}

module.exports = { DynamicSessionGenerator };