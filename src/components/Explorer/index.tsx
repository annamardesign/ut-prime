import React from 'react';
import lodashGet from 'lodash.get';
import merge from 'ut-function.merge';
import clsx from 'clsx';
import {createUseStyles} from 'react-jss';

import Card from '../Card';
import { Button, DataTable, DataView, Column, Toolbar, Splitter, SplitterPanel } from '../prime';
import ActionButton from '../ActionButton';
import Permission from '../Permission';
import useToggle from '../hooks/useToggle';
import useSubmit from '../hooks/useSubmit';
import useLayout from '../hooks/useLayout';
import useLoad from '../hooks/useLoad';
import useWindowSize from '../hooks/useWindowSize';
import Editor from '../Editor';
import Form from '../Form';
import fieldNames from '../lib/fields';
import columnProps, {TableFilter} from '../lib/column';
import prepareSubmit from '../lib/prepareSubmit';

import { ComponentProps } from './Explorer.types';
import testid from '../lib/testid';
import useCustomization from '../hooks/useCustomization';

const backgroundNone = {background: 'none'};
const splitterWidth = { width: '200px' };

const fieldName = column => typeof column === 'string' ? column : column.name;

const useStyles = createUseStyles({
    explorer: {
        '& .p-card .p-card-content': {
            padding: 0
        },
        '& .p-datatable-wrapper': {
            overflowX: 'auto',
            '& .p-button': {
                textAlign: 'inherit'
            }
        },
        '& .p-datatable-scrollable .p-datatable-thead>tr>th': {
            minWidth: '3rem',
            position: 'relative',
            flexDirection: 'column',
            alignItems: 'unset',
            justifyContent: 'space-evenly'
        },
        '& .p-datatable-scrollable .p-datatable-tbody>tr>td': {
            minWidth: '3rem',
            flexDirection: 'column',
            alignItems: 'unset',
            justifyContent: 'space-evenly'
        },
        '& .p-grid': {
            margin: '0.5em'
        },
        '& .p-dataview': {
            '& .p-dataview-content': {
                overflowY: 'auto',
                maxHeight: 'inherit',
                background: 'none',
                '& .p-card': {
                    '& .p-card-content': {
                        padding: 0
                    }
                }
            }
        },
        '& .p-splitter-panel': {
            overflowY: 'auto'
        },
        '& .p-toolbar-group-left': {
            flexGrow: 1
        }
    },
    details: {
        marginBottom: 15
    },
    detailsLabel: {},
    detailsValue: {}
});

const empty = [];

const Explorer: ComponentProps = ({
    className,
    keyField,
    fetch: fetchParams,
    subscribe,
    schema,
    resultSet,
    children,
    details,
    toolbar,
    filter: initFilter,
    params,
    design: designDefault,
    onDropdown,
    showFilter = true,
    pageSize = 10,
    table: tableProps,
    view: viewProps,
    customization,
    onCustomization,
    name,
    layouts,
    layout: layoutName,
    cards,
    editors,
    methods
}) => {
    const [trigger, setTrigger] = React.useState<() => void>();
    const [paramValues, submitParams] = React.useState<[Record<string, unknown>] | [Record<string, unknown>, {files: []}]>([params]);
    const [filter, index] = React.useMemo(() => [
        {
            [resultSet]: paramValues[0]
        },
        {
            ...paramValues[1],
            files: paramValues?.[1]?.files?.map(name => `${resultSet}.${name}`)
        }
    ], [paramValues, resultSet]);

    const [loading, setLoading] = React.useState(false);
    const [customizationToolbar, mergedSchema, mergedCards, inspector, loadCustomization, , , , , formProps] =
        useCustomization(designDefault, schema, cards, layouts, customization, 'view', '', Editor, undefined, onCustomization, methods, name, loading);
    const layoutProps = layouts?.[layoutName] || {};
    const columnsCard = ('columns' in layoutProps) ? layoutProps.columns : 'browse';
    const toolbarCard = ('toolbar' in layoutProps) ? layoutProps.toolbar : 'toolbar';
    const layout = ('layout' in layoutProps) ? layoutProps.layout : empty;
    const columns = ('layout' in layoutProps) ? empty : mergedCards[columnsCard]?.widgets ?? empty;
    const paramsLayout = ('params' in layoutProps) && layoutProps.params;
    const paramsSchema = mergedSchema?.properties?.params;
    const fetch = React.useMemo(() => (!paramsLayout || paramValues.length > 1) && fetchParams, [fetchParams, paramValues, paramsLayout]);
    toolbar = ('layout' in layoutProps) ? toolbar : mergedCards[toolbarCard]?.widgets ?? toolbar;
    const classes = useStyles();
    const {properties} = mergedSchema;
    const [tableFilter, setFilters] = React.useState<TableFilter>({
        filters: columns?.reduce((prev : object, column) => {
            let field = fieldName(column);
            const value = lodashGet(initFilter, field);
            field = field.split('.').pop();
            return (value === undefined) ? {...prev, [field]: {matchMode: 'contains'}} : {...prev, [field]: {value, matchMode: 'contains'}};
        }, {}),
        first: 0,
        page: 1
    });
    const handleFilterPageSort = React.useCallback(event => setFilters(prev => ({...prev, ...event})), []);

    const [selected, setSelected] = React.useState(null);
    const handleSelectionChange = React.useCallback(e => setSelected(e.value), []);

    const [current, setCurrent] = React.useState(null);
    const handleRowSelect = React.useCallback(e => setCurrent(e.data), []);

    const [navigationOpened, navigationToggle] = useToggle(true);
    const [detailsOpened, detailsToggle] = useToggle(true);

    const [[items, totalRecords], setItems] = React.useState([[], 0]);
    const [dropdowns, setDropdown] = React.useState({});

    const {dropdownNames: formDropdownNames = []} = paramsLayout ? fieldNames(paramsLayout, mergedCards, paramsSchema, editors) : {};

    const dropdownNames = (columns || [])
        .flat()
        .filter(Boolean)
        .map(column => lodashGet(properties, fieldName(column)?.replace(/\./g, '.properties.'))?.widget?.dropdown)
        .filter(Boolean)
        .concat(formDropdownNames)
        .join(',');

    const getValues = React.useMemo(() => () => ({
        id: current && current[keyField],
        current,
        selected
    }), [current, keyField, selected]);

    const buttons = React.useMemo(() => (toolbar || []).map((widget, index) => {
        const {title, action, params, enabled, disabled, permission} = (typeof widget === 'string') ? properties[widget].widget : widget;
        const check = criteria => {
            if (typeof criteria?.validate === 'function') return !criteria.validate({current, selected}).error;
            if (typeof criteria !== 'string') return !!criteria;
            switch (criteria) {
                case 'current': return !!current;
                case 'selected': return selected && selected.length > 0;
                case 'single': return selected && selected.length === 1;
                default: return false;
            }
        };
        const isDisabled =
            enabled != null
                ? !check(enabled)
                : disabled != null
                    ? check(disabled)
                    : undefined;
        return (
            <Permission key={index} permission={permission}>
                <ActionButton
                    {...testid(`${permission ? (permission + 'Button') : ('button' + index)}`)}
                    label={title}
                    action={action}
                    params={params}
                    getValues={getValues}
                    disabled={isDisabled}
                    className="mr-2"
                />
            </Permission>
        );
    }
    ), [toolbar, current, selected, getValues, properties]);
    const {toast, handleSubmit: load} = useSubmit(
        async function() {
            if (!fetch) {
                setItems([[], 0]);
                setDropdown({});
            } else {
                setLoading(true);
                try {
                    const items = await fetch(prepareSubmit([merge(
                        {},
                        filter,
                        {
                            [resultSet || 'filterBy']: Object.entries(tableFilter.filters).reduce((prev, [name, {value}]) => ({...prev, [name]: value}), {})
                        },
                        tableFilter.sortField && {
                            orderBy: [{
                                field: tableFilter.sortField,
                                dir: {[-1]: 'DESC', 1: 'ASC'}[tableFilter.sortOrder]
                            }]
                        },
                        pageSize && {
                            paging: {
                                pageSize,
                                pageNumber: Math.floor(tableFilter.first / pageSize) + 1
                            }
                        }
                    ), index]));
                    const records = (resultSet ? items[resultSet] : items) as unknown[];
                    let total = items.pagination && items.pagination.recordsTotal;
                    if (total == null) {
                        total = (Array.isArray(records) && records.length) || 0;
                        if (total === pageSize) total++;
                        total = tableFilter.first + total;
                    }
                    setItems([records, total]);
                } finally {
                    setLoading(false);
                }
            }
        },
        [fetch, filter, index, pageSize, resultSet, tableFilter]
    );
    useLoad(async() => {
        if (onDropdown) setDropdown(await onDropdown(dropdownNames.split(',').filter(Boolean)));
    }, [onDropdown, dropdownNames]);
    React.useEffect(() => {
        load();
        if (subscribe && !formProps.design) {
            return subscribe(rows => {
                setItems(([items, totalRecords]) => [(Array.isArray(rows) || !keyField) ? rows as unknown[] : items.map(item => {
                    const update = rows[item[keyField]];
                    return update ? {...item, ...update} : item;
                }), totalRecords]);
            });
        }
    }, [keyField, load, subscribe, formProps.design]);
    React.useEffect(() => {
        loadCustomization();
    });

    const windowSize = useWindowSize();
    const [height, setHeight] = React.useState<{height: number}>();
    const [maxHeight, setMaxHeight] = React.useState<{maxHeight: number}>();
    const [splitterHeight, setSplitterHeight] = React.useState({});

    const max = maxHeight => (!isNaN(maxHeight) && maxHeight > 0) ? Math.floor(maxHeight) : 0;

    const tableWrapRef = React.useCallback(node => {
        if (node === null) return;
        const nodeRect = node.getBoundingClientRect();
        const paginatorHeight = node.querySelector('.p-paginator')?.getBoundingClientRect?.()?.height;
        setHeight({height: max(windowSize.height - nodeRect.top)});
        setMaxHeight({maxHeight: max(windowSize.height - nodeRect.top - paginatorHeight)});
    }, [windowSize.height]);

    const splitterWrapRef = React.useCallback(node => {
        if (node === null) return;
        const nodeRect = node.getBoundingClientRect();
        setSplitterHeight({flexGrow: 1, height: max(windowSize.height - nodeRect.top)});
    }, [windowSize.height]);

    const detailsPanel = React.useMemo(() => detailsOpened && details &&
        <SplitterPanel style={height} key='details' size={10}>
            <div style={splitterWidth}>{
                current && Object.entries(details).map(([name, value], index) =>
                    <div className={classes.details} key={index}>
                        <div className={classes.detailsLabel}>{value}</div>
                        <div className={classes.detailsValue}>{current[name]}</div>
                    </div>
                )
            }</div>
        </SplitterPanel>, [classes.details, classes.detailsLabel, classes.detailsValue, current, details, detailsOpened, height]);

    const filterBy = (name: string, key: string) => e => {
        const value = lodashGet(e, key);
        setFilters(prev => {
            const next = {
                ...prev,
                filters: {
                    ...prev?.filters,
                    [name]: {
                        ...prev?.filters?.[name],
                        value: value === '' ? undefined : value
                    }
                }
            };
            return next;
        });
    };

    const filterDisplay = React.useMemo(() => showFilter && columns.some(column => {
        const isString = typeof column === 'string';
        const {name, ...widget} = isString ? {name: column} : column;
        const property = lodashGet(properties, name?.replace(/\./g, '.properties.'));
        return !!property?.filter || widget?.column?.filter;
    }), [columns, properties, showFilter]) ? 'row' : undefined;

    const Columns = React.useMemo(() => columns.map((column, index) => {
        const isString = typeof column === 'string';
        const {name, ...widget} = isString ? {name: column} : column;
        const property = lodashGet(properties, name?.replace(/\./g, '.properties.'));
        const action = widget.action ?? property?.action;
        const field = name.split('.').pop();
        return (
            <Column
                key={name}
                body={action && (row => <ActionButton
                    {...testid(`${resultSet || 'filterBy'}.${field}Item/${row && row[keyField]}`)}
                    label={row[field]}
                    className='p-button-link p-0'
                    action={action}
                    params={widget.params ?? property?.params}
                    getValues={() => ({
                        id: row && row[keyField],
                        current: row,
                        selected: [row]
                    })}
                    // onClick={() => property.action({
                    //     id: row && row[keyField],
                    //     current: row,
                    //     selected: [row]
                    // })}
                />)}
                filter={showFilter && !!property?.filter}
                sortable={!!property?.sort}
                {...columnProps({index, card: columnsCard, name: field, widget: !isString && widget, property, dropdowns, tableFilter, filterBy, ...formProps})}
            />
        );
    }), [columns, columnsCard, properties, showFilter, dropdowns, tableFilter, keyField, resultSet, formProps]);
    const hasChildren = !!children;

    const paramsElement = React.useMemo(() => {
        if (!paramsLayout) return null;
        return <div className='flex align-items-center w-full'>
            <Form
                className='p-0 m-0 flex-grow-1'
                schema={paramsSchema}
                cards={cards}
                layout={paramsLayout}
                onSubmit={submitParams}
                value={paramValues[0]}
                dropdowns={dropdowns}
                setTrigger={setTrigger}
                triggerNotDirty
                autoSubmit
            />
        </div>;
    }, [dropdowns, cards, paramsLayout, paramValues, paramsSchema, submitParams, setTrigger]);

    const left = React.useMemo(() => paramsElement ?? <>
        {hasChildren && <Button {...testid(`${resultSet}.navigator.toggleButton`)} icon="pi pi-bars" className="mr-2" onClick={navigationToggle}/>}
        {buttons}
    </>, [navigationToggle, buttons, hasChildren, resultSet, paramsElement]);
    const right = <>
        <Button icon="pi pi-search" className="mr-2 ml-2" onClick={trigger} {...testid(`${resultSet}.refreshButton`)}/>
        {details && <Button {...testid(`${resultSet}.details.toggleButton`)} icon="pi pi-bars" className="mr-2" onClick={detailsToggle}/>}
        {customizationToolbar}
    </>;
    const layoutState = useLayout(mergedSchema, mergedCards, layout, editors, keyField);
    const cardName = layout?.flat()[0];
    const itemTemplate = React.useMemo(() => item => {
        function renderItem() {
            const card = <Card
                index1={0}
                index2={0}
                cards={mergedCards}
                cardName={cardName}
                layoutState={layoutState}
                dropdowns={dropdowns}
                methods={methods}
                value={item}
                classNames={{
                    widget: 'grid field justify-content-center'
                }}
            />;
            return keyField ? <div
                {...testid(`${resultSet || 'filterBy'}.${keyField}/${item && item[keyField]}`)}
                className={clsx('cursor-pointer', (cardName && mergedCards?.[typeof cardName === 'string' ? cardName : cardName.name]?.className) || 'col-6 lg:col-2 md:col-3 sm:col-4')}
                onClick={layoutState.open?.(item)}
            >{card}</div> : card;
        }
        return renderItem();
    }, [mergedCards, layoutState, dropdowns, methods, keyField, resultSet, cardName]);
    const table = (
        <div ref={tableWrapRef} style={height}>
            {layout?.length ? <DataView
                layout='grid'
                style={maxHeight}
                lazy
                gutter
                rows={pageSize}
                totalRecords={totalRecords}
                paginator
                first={tableFilter.first}
                sortField={tableFilter.sortField}
                sortOrder={tableFilter.sortOrder}
                value={items}
                onPage={handleFilterPageSort}
                itemTemplate={itemTemplate}
                {...viewProps}
            /> : <DataTable
                scrollable
                // tableStyle={{maxHeight: dataTableHeight}}
                scrollHeight='flex'
                autoLayout
                lazy
                rows={pageSize}
                totalRecords={totalRecords}
                paginator
                first={tableFilter.first}
                sortField={tableFilter.sortField}
                sortOrder={tableFilter.sortOrder}
                filters={tableFilter.filters}
                onPage={handleFilterPageSort}
                onSort={handleFilterPageSort}
                onFilter={handleFilterPageSort}
                loading={loading}
                dataKey={keyField}
                value={items}
                selection={selected}
                filterDisplay={filterDisplay}
                onSelectionChange={handleSelectionChange}
                onRowSelect={handleRowSelect}
                {...tableProps}
            >
                {keyField && (!tableProps?.selectionMode || tableProps?.selectionMode === 'checkbox') && <Column selectionMode="multiple" className='flex-grow-0'/>}
                {Columns}
            </DataTable>}
        </div>
    );
    const nav = children && navigationOpened && <SplitterPanel style={height} key='nav' size={15}>
        {children}
    </SplitterPanel>;
    return (
        <div className={clsx('flex', 'flex-column', classes.explorer, className)}>
            {toast}
            {
                (toolbar !== false) || nav || detailsPanel
                    ? <Toolbar left={left} right={right} style={backgroundNone} className='border-none p-2 flex-nowrap' />
                    : null
            }
            <div className='flex'>
                <div className='flex-grow-1'>
                    {
                        (nav || detailsPanel)
                            ? <div ref={splitterWrapRef}>
                                <Splitter style={splitterHeight}>
                                    {[
                                        nav,
                                        <SplitterPanel style={height} key='items' size={nav ? detailsPanel ? 75 : 85 : 90}>
                                            {table}
                                        </SplitterPanel>,
                                        detailsPanel
                                    ].filter(Boolean)}
                                </Splitter>
                            </div>
                            : table
                    }
                </div>
                {inspector}
            </div>
        </div>
    );
};

export default Explorer;
