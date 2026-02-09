export interface MarketSentiment {
  score: number;
  label: 'bearish' | 'neutral' | 'bullish';
  confidence: number;
  factors: SentimentFactor[];
  timestamp: number;
}

export interface SentimentFactor {
  source: string;
  impact: number;
  description: string;
}

export interface StrategyAdjustment {
  positionSizeMultiplier: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedExposure: number;
  stopLossAdjustment: number;
  reasoning: string;
}

export interface AIAnalysisResult {
  sentiment: MarketSentiment;
  adjustment: StrategyAdjustment;
  marketConditions: {
    volatility: number;
    trend: 'up' | 'down' | 'sideways';
    volume: number;
  };
  recommendations: string[];
}

export class AISentimentAnalyzer {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || '';
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  async analyzeMarketSentiment(
    marketData: string,
    portfolioValue: number,
    recentPerformance: number
  ): Promise<AIAnalysisResult> {
    try {
      if (!this.apiKey) {
        return this.getFallbackAnalysis(portfolioValue, recentPerformance);
      }

      const prompt = `Analyze the following crypto market data and provide a sentiment score between -1 (very bearish) and 1 (very bullish):

Market Data: ${marketData}

Current Portfolio Value: $${portfolioValue}
Recent Performance: ${recentPerformance > 0 ? '+' : ''}${recentPerformance.toFixed(2)}%

Provide your analysis in JSON format with the following structure:
{
  "sentimentScore": <number between -1 and 1>,
  "confidence": <number between 0 and 1>,
  "volatility": <number representing market volatility>,
  "trend": <"up" | "down" | "sideways">,
  "reasoning": <string>,
  "recommendations": [<array of actionable recommendations>]
}`;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert crypto market analyst. Provide concise, actionable insights in JSON format only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices[0].message.content;

      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const analysis = JSON.parse(cleanContent);

      return this.formatAnalysisResult(analysis, portfolioValue);
    } catch (error) {
      console.error('AI sentiment analysis failed:', error);
      return this.getFallbackAnalysis(portfolioValue, recentPerformance);
    }
  }

  private formatAnalysisResult(
    analysis: {
      sentimentScore: number;
      confidence: number;
      volatility: number;
      trend: 'up' | 'down' | 'sideways';
      reasoning: string;
      recommendations: string[];
    },
    portfolioValue: number
  ): AIAnalysisResult {
    const score = Math.max(-1, Math.min(1, analysis.sentimentScore));

    const sentiment: MarketSentiment = {
      score,
      label: score > 0.3 ? 'bullish' : score < -0.3 ? 'bearish' : 'neutral',
      confidence: analysis.confidence,
      factors: [
        {
          source: 'AI Analysis',
          impact: score,
          description: analysis.reasoning,
        },
      ],
      timestamp: Date.now(),
    };

    let positionMultiplier = 1.0;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    let exposure = 50;

    if (score > 0.5) {
      positionMultiplier = 1.5;
      riskLevel = 'high';
      exposure = 70;
    } else if (score > 0.2) {
      positionMultiplier = 1.2;
      riskLevel = 'medium';
      exposure = 60;
    } else if (score < -0.5) {
      positionMultiplier = 0.5;
      riskLevel = 'low';
      exposure = 30;
    } else if (score < -0.2) {
      positionMultiplier = 0.7;
      riskLevel = 'low';
      exposure = 40;
    }

    const adjustment: StrategyAdjustment = {
      positionSizeMultiplier: positionMultiplier,
      riskLevel,
      recommendedExposure: exposure,
      stopLossAdjustment: sentiment.label === 'bearish' ? -2 : 0,
      reasoning: analysis.reasoning,
    };

    return {
      sentiment,
      adjustment,
      marketConditions: {
        volatility: analysis.volatility || 0.5,
        trend: analysis.trend,
        volume: portfolioValue,
      },
      recommendations: analysis.recommendations || [],
    };
  }

  private getFallbackAnalysis(
    portfolioValue: number,
    recentPerformance: number
  ): AIAnalysisResult {
    const score = recentPerformance > 5 ? 0.6 : recentPerformance < -5 ? -0.6 : 0;

    return {
      sentiment: {
        score,
        label: score > 0.3 ? 'bullish' : score < -0.3 ? 'bearish' : 'neutral',
        confidence: 0.5,
        factors: [
          {
            source: 'Performance Analysis',
            impact: score,
            description: `Based on ${recentPerformance.toFixed(2)}% recent performance`,
          },
        ],
        timestamp: Date.now(),
      },
      adjustment: {
        positionSizeMultiplier: 1.0,
        riskLevel: 'medium',
        recommendedExposure: 50,
        stopLossAdjustment: 0,
        reasoning: 'Using conservative fallback analysis',
      },
      marketConditions: {
        volatility: 0.5,
        trend: recentPerformance > 0 ? 'up' : recentPerformance < 0 ? 'down' : 'sideways',
        volume: portfolioValue,
      },
      recommendations: [
        'Monitor market conditions closely',
        'Maintain diversified portfolio',
        'Set appropriate stop losses',
      ],
    };
  }

  calculateDynamicPositionSize(
    baseSize: number,
    sentiment: MarketSentiment,
    adjustment: StrategyAdjustment
  ): number {
    return baseSize * adjustment.positionSizeMultiplier * sentiment.confidence;
  }
}

export const createAISentimentAnalyzer = (apiKey?: string) => {
  return new AISentimentAnalyzer(apiKey);
};
