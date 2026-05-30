const AI = require('../models/ai.model');
const Message = require('../helpers/constant.message');
// const OpenAI = require('openai');
// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY
// });
// const GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const AIService = {
    searchByOpenAI: async (req) => {
        try {
            //  const response = await openai.chat.completions.create({
            //     model: "gpt-4.1-mini",
            //     messages: [
            //         {
            //             role: "user",
            //             content: `Search for: ${req.body.query}`
            //         }
            //     ]
            // });
            const aiObject = {
                userId: req.userId,
                query: req.body.query,
                response: '' //response.choices[0].message.content
            }
            const ai = new AI(aiObject);
            await ai.save();
            return ai;
        } catch (error) {
            throw error;
        }
    },
    searchByGoogleGenerativeAI: async (req) => {
        try {
            // const model = genAI.getGenerativeModel({
            //     model: "gemini-3.1-flash-lite",
            // });

            // const result = await model.generateContent(req.body.query);

            // console.log(result.response.text());
            const aiObject = {
                userId: req.userId,
                query: req.body.query,
                response: '' //result.response.text()
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