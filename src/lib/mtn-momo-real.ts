/**
 * Real MTN MoMo Zambia API payment integration service (Collections / Request-to-Pay)
 * 
 * To activate live payments, grab your credentials from https://momodeveloper.mtn.com
 * and configure these keys in your environment (.env.local):
 * 
 * MTN_MOMO_SUBSCRIPTION_KEY="your_primary_ocp_apim_subscription_key"
 * MTN_MOMO_API_USER="your_generated_api_user_uuid"
 * MTN_MOMO_API_KEY="your_generated_api_key"
 * MTN_MOMO_TARGET_ENV="sandbox" # or "production" when live
 */

export interface MtnPaymentRequest {
  orderId: string;
  phone: string; // e.g. "260971234567"
  amount: number;
  reference: string;
}

export interface MtnPaymentStatus {
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  financialTransactionId?: string;
  reason?: string;
}

export const MtnMomoRealService = {
  get config() {
    return {
      subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY || '',
      apiUser: process.env.MTN_MOMO_API_USER || '',
      apiKey: process.env.MTN_MOMO_API_KEY || '',
      targetEnv: process.env.MTN_MOMO_TARGET_ENV || 'sandbox',
      baseUrl: process.env.MTN_MOMO_TARGET_ENV === 'production'
        ? 'https://proxy.momoapi.mtn.com'
        : 'https://sandbox.momodeveloper.mtn.com'
    };
  },

  /**
   * Helper to generate a unique UUID v4 (X-Reference-Id) for API requests
   */
  generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * 1. Get OAuth2 Access Token from MTN MoMo Gateway
   */
  async getAccessToken(): Promise<string> {
    const { baseUrl, apiUser, apiKey, subscriptionKey } = this.config;

    if (!subscriptionKey || !apiUser || !apiKey) {
      throw new Error('MTN MoMo: Missing API credentials in environment.');
    }

    const auth = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');

    const response = await fetch(`${baseUrl}/collection/token/`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MTN MoMo token generation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  },

  /**
   * 2. Initiate USSD Request-to-Pay Collection (USSD push prompt on user's phone)
   */
  async requestToPay(params: MtnPaymentRequest): Promise<{ txRefId: string }> {
    const { baseUrl, subscriptionKey, targetEnv } = this.config;
    const txRefId = this.generateUuid();

    // Ensure phone number starts with country prefix without +
    let formattedPhone = params.phone.trim().replace(/\+/g, '');
    if (formattedPhone.startsWith('09') || formattedPhone.startsWith('07')) {
      formattedPhone = '260' + formattedPhone.substring(1);
    }

    const token = await this.getAccessToken();

    const body = {
      amount: params.amount.toFixed(2),
      currency: targetEnv === 'production' ? 'ZMW' : 'EUR', // Sandbox default currency is EUR
      externalId: params.reference,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone
      },
      payerMessage: `BKR Delivery payment for ${params.reference}`,
      payeeNote: `BKR Escrow payment`
    };

    const response = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'X-Reference-Id': txRefId,
        'X-Target-Environment': targetEnv,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (response.status !== 202) {
      const errorText = await response.text();
      throw new Error(`MTN MoMo requesttopay failed: ${response.status} - ${errorText}`);
    }

    return { txRefId };
  },

  /**
   * 3. Get Collection Payment Status (Check if user entered PIN and approved)
   */
  async getPaymentStatus(txRefId: string): Promise<MtnPaymentStatus> {
    const { baseUrl, subscriptionKey, targetEnv } = this.config;
    const token = await this.getAccessToken();

    const response = await fetch(`${baseUrl}/collection/v1_0/requesttopay/${txRefId}`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'X-Target-Environment': targetEnv,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MTN MoMo status check failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // MTN returns: PENDING, SUCCESSFUL, or FAILED
    return {
      status: data.status,
      financialTransactionId: data.financialTransactionId || undefined,
      reason: data.reason || undefined
    };
  }
};
