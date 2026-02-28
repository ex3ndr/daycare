import { Avatar } from "@/components/Avatar";
import { Item } from "@/components/Item";
import { ItemGroup } from "@/components/ItemGroup";
import { ItemListStatic } from "@/components/ItemList";

export function PeopleView() {
    return (
        <ItemListStatic>
            <ItemGroup title="Team">
                <Item
                    title="Alex Rivera"
                    subtitle="alex@daycare.dev"
                    leftElement={<Avatar id="alex" size={32} />}
                    showChevron={false}
                />
                <Item
                    title="Jordan Chen"
                    subtitle="jordan@daycare.dev"
                    leftElement={<Avatar id="jordan" size={32} />}
                    showChevron={false}
                />
                <Item
                    title="Sam Patel"
                    subtitle="sam@daycare.dev"
                    leftElement={<Avatar id="sam" size={32} />}
                    showChevron={false}
                />
                <Item
                    title="Morgan Lee"
                    subtitle="morgan@daycare.dev"
                    leftElement={<Avatar id="morgan" size={32} />}
                    showChevron={false}
                />
            </ItemGroup>
            <ItemGroup title="External">
                <Item
                    title="Chris Taylor"
                    subtitle="chris@acme.io"
                    leftElement={<Avatar id="chris" size={32} />}
                    showChevron={false}
                />
                <Item
                    title="Pat Kim"
                    subtitle="pat@vendor.co"
                    leftElement={<Avatar id="pat" size={32} />}
                    showChevron={false}
                />
                <Item
                    title="Dana Novak"
                    subtitle="dana@partner.org"
                    leftElement={<Avatar id="dana" size={32} />}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemListStatic>
    );
}
