import { InternalReducer, Reduxable } from '@weavedev/reduxable';
import { Action } from 'redux';

export const defaultStateSourceMarker: unique symbol = Symbol('defaultStateSourceMarker');

type TypeFromReduxable<R extends Reduxable<any, any, any[]>> = R['actionMap'][keyof R['actionMap']]['type'];

type TypesFromReduxable<R extends Reduxable<any, any, any[]>> = TypeFromReduxable<R>[];

interface ReadWriteTransformer<S, M> {
    read(s: M): S;
    write(s: S): M;
}

interface ReduxLocalStorageOptions<R extends Reduxable<any, any, any[]>, S> {
    transform?: ReadWriteTransformer<R['state'], S>;
    triggers?: TypesFromReduxable<R>;
}

/**
 * Typed redux local storage class that mirrors state to and from JavaScript's `window.localStorage`.
 */
export class ReduxLocalStorage<
    R extends Reduxable<any, any, any[]>,
    M = R['state']
> extends Reduxable<R['state'], R['actionMap'], Parameters<R['run']>> {
    public readonly actionTypeMap: R['actionTypeMap'];

    private readonly reduxable: R;
    private readonly target: string;
    private readonly transform: ReadWriteTransformer<R['state'], M>;
    private readonly triggers?: TypesFromReduxable<R>;

    constructor(reduxable: R, target: string, options?: ReduxLocalStorageOptions<R, M>) {
        super();
        this.reduxable = reduxable;
        this.target = target;
        this.actionTypeMap = reduxable.actionTypeMap;

        this.transform = options && options.transform ? options.transform : {
            read: (s: M): R['state'] => <R['state']><unknown>s,
            write: (s: R['state']): M => <M><unknown>s,
        };
        this.triggers = options ? options.triggers : undefined;
    }

    public get actionMap(): R['actionMap'] {
        throw new Error('ReduxLocalStorage.actionMap should only be used as a TypeScript type provider (typeof .actionMap)');
    }

    /**
     * Passthrough default state with marker added to identify defaultState in the reducer.
     */
    public get defaultState(): R['state'] {
        return {
            ...(<R['state']>this.reduxable.defaultState),
            [defaultStateSourceMarker]: true,
        };
    }

    protected get internalReducer(): InternalReducer<R['state']> {
        const context: ReduxLocalStorage<R> = this;

        return (s: R['state'], a: Action): R['state'] => {
            let inputState: R['state'] = s;

            // Check if we're building from the defaultState
            if (inputState[defaultStateSourceMarker]) {
                let useDefaultState: boolean = true;

                // Try to load from localStorage
                const storedStateString: string | null = window.localStorage.getItem(context.target);
                if (storedStateString !== null) {
                    try {
                        // Unmarshal string
                        inputState = context.transform.read(<M>JSON.parse(storedStateString));

                        // Use saved state instead of default state
                        useDefaultState = false;
                    } catch (e) {
                        console.warn('Could not unmarshal state from localStorage', e);
                    }
                }

                // Fallback to default state and clean up marker
                if (useDefaultState) {
                    // Clone object
                    inputState = { ...s };

                    // Remove marker
                    delete inputState[defaultStateSourceMarker]; // tslint:disable-line:no-dynamic-delete
                }

                // Setup reducer with initial state
                return <R['state']>context.reduxable.reducer(inputState, a);
            }

            // Run reducer
            const nextState: R['state'] = <R['state']>context.reduxable.reducer(s, a);

            // If a different state is returned check if we need to save to localStorage
            // tslint:disable-next-line: no-unsafe-any
            if (nextState !== s && (context.triggers === undefined || context.triggers.indexOf(a.type) >= 0)) {
                try {
                    window.localStorage.setItem(context.target, JSON.stringify(context.transform.write(nextState)));
                } catch (e) {
                    console.warn('Could not marshal state to localStorage', e);
                }
            }

            return nextState;
        };
    }

    // Passthrough saga
    public get saga(): R['saga'] {
        return this.reduxable.saga;
    }

    // Passthrough run
    public run(...i: Parameters<R['run']>): ReturnType<R['run']> {
        return <ReturnType<R['run']>>this.reduxable.run(...i);
    }

    // Passthrough runSaga
    public get runSaga(): R['runSaga'] {
        return this.reduxable.runSaga;
    }
}
