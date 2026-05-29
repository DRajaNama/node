const AI = require('../models/ai.model');
const Message = require('../helpers/constant.message');
const OpenAI = require('openai');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const AIService = {
    searchByAI: async (req) => {
        try {
             const response = await openai.chat.completions.create({
                model: "gpt-4.1-mini",
                messages: [
                    {
                        role: "user",
                        content: `Search for: ${req.body.query}`
                    }
                ]
            });
            const aiObject = {
                userId: req.userId,
                query: req.body.query,
                response: response.choices[0].message.content
            }
            const ai = new AI(aiObject);
            await ai.save();
            return ai;
        } catch (error) {
            throw error;
        }
    }

};

module.exports = AIService;