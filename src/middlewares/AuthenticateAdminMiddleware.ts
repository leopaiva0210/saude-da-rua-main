import {
    APIGatewayRequestAuthorizerEventV2,
    APIGatewayAuthorizerResult,
    PolicyDocument,
} from 'aws-lambda';
import VerifyJWT from '../utils/auth/VerifyJWT';

class AuthenticateAdminMiddleware {
    private event: APIGatewayRequestAuthorizerEventV2;

    private validToken: string;

    constructor(event: APIGatewayRequestAuthorizerEventV2) {
        this.event = event;

        this.validToken = AuthenticateAdminMiddleware.getToken(event);
    }

    static getPolicyDocument = (
        effect: string,
        resource: string
    ): PolicyDocument => ({
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: resource,
            },
        ],
    });

    static getToken = (event: APIGatewayRequestAuthorizerEventV2): string => {
        if (!event.type || event.type !== 'REQUEST') {
            throw new Error(
                `Expected 'event.type' parameter exists and to have a value equal to 'REQUEST'`
            );
        }

        const getTokenFromHeaders: string = event.headers.authorization;

        if (!getTokenFromHeaders) {
            throw new Error(
                'Expected "event.headers.authorizationToken" parameter to be set'
            );
        }

        const checkIfTokenMatches = getTokenFromHeaders.match(/^Bearer (.*)$/);

        if (!checkIfTokenMatches || checkIfTokenMatches.length < 2) {
            throw new Error(
                `Invalid Authorization token - ${getTokenFromHeaders} does not match "Bearer .*"`
            );
        }

        return checkIfTokenMatches[1];
    };

    public authenticate = (): APIGatewayAuthorizerResult => {
        try {
            const verifyJWT = new VerifyJWT(this.validToken);
            const { admin, sub } = verifyJWT.payloadFromCheckedToken();

            return {
                principalId: admin.id,
                policyDocument: AuthenticateAdminMiddleware.getPolicyDocument(
                    'Allow',
                    this.event.routeArn
                ),
                context: {
                    subject: sub,
                    adminId: admin.id,
                    adminName: admin.name,
                },
            };
        } catch (error) {
            throw new Error('Expired or invalid token');
        }
    };
}

export default AuthenticateAdminMiddleware;
